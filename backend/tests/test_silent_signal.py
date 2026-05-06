"""Silent Signal — Iteration 2 backend tests.

Covers:
  • NaCl per-recipient encryption (encryptedFor map) on POST/GET /api/messages
  • PUT /api/users/me/public-key
  • Brute-force lockout on /api/auth/login (5 fails -> 429)
  • Regex escaping on /api/friends/search
  • GET /api/rooms/{id} returns members with publicKey
  • WebSocket /api/ws?token=... — hello, ping/pong, bad token close, broadcast
"""
import os
import json
import uuid
import asyncio
import hashlib

import pytest
import requests
import websockets
import nacl.public
import nacl.utils
import nacl.encoding
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

KEYPAIR_DOMAIN = "silent-signal-v1"


def _derive_keypair(email: str, password: str):
    seed = hashlib.sha256(f"{email}:{password}:{KEYPAIR_DOMAIN}".encode()).digest()
    sk = nacl.public.PrivateKey(seed)
    return sk, sk.public_key


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ─── DB helper to clear lockouts so this test suite is repeatable ───────────
@pytest.fixture(scope="session", autouse=True)
def _cleanup_login_attempts():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "silent_signal")
    cli = MongoClient(mongo_url)
    cli[db_name].login_attempts.delete_many({})
    yield
    cli[db_name].login_attempts.delete_many({})
    cli.close()


@pytest.fixture(scope="module")
def alex():
    r = _login("alex@silent.app", "demo1234")
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["access_token"], "id": body["user"]["id"], "user": body["user"]}


@pytest.fixture(scope="module")
def maya():
    r = _login("maya@silent.app", "demo1234")
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["access_token"], "id": body["user"]["id"], "user": body["user"]}


# ── Auth basics ─────────────────────────────────────────────────────────────
class TestAuth:
    def test_me(self, alex):
        r = requests.get(f"{API}/auth/me", headers=_headers(alex["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "alex@silent.app"
        assert r.json()["user"]["publicKey"]


class TestPublicKey:
    def test_put_public_key(self, alex):
        # Generate a throwaway pubkey and PUT it, then restore the original
        original = alex["user"]["publicKey"]
        new_sk = nacl.public.PrivateKey.generate()
        new_pk = new_sk.public_key.encode(nacl.encoding.Base64Encoder).decode()
        r = requests.put(
            f"{API}/users/me/public-key",
            headers=_headers(alex["token"]),
            json={"publicKey": new_pk},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # verify
        me = requests.get(f"{API}/auth/me", headers=_headers(alex["token"]), timeout=15).json()
        assert me["user"]["publicKey"] == new_pk
        # restore
        requests.put(
            f"{API}/users/me/public-key",
            headers=_headers(alex["token"]),
            json={"publicKey": original},
            timeout=15,
        )


# ── Brute-force lockout ─────────────────────────────────────────────────────
class TestLockout:
    def test_lockout_after_5_fails(self):
        email = f"lockout_{uuid.uuid4().hex[:6]}@silent.app"
        # register so the email exists (lockout key is ip:email — both real and bogus emails work)
        requests.post(f"{API}/auth/register", json={"email": email, "password": "correct1", "name": "T"}, timeout=15)
        # Wrong password 5 times
        codes = []
        for _ in range(5):
            r = _login(email, "wrong-pass")
            codes.append(r.status_code)
        assert all(c == 401 for c in codes), f"expected 5x 401, got {codes}"
        # 6th attempt should be locked out (429) - even with correct pass
        r6 = _login(email, "correct1")
        assert r6.status_code == 429, f"expected 429, got {r6.status_code}: {r6.text}"
        assert "Too many" in r6.json().get("detail", "")

    def test_clear_after_success_then_login(self):
        # cleanup fixture already ran; manually clear for alex too
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "silent_signal")
        cli = MongoClient(mongo_url)
        cli[db_name].login_attempts.delete_many({})
        cli.close()
        # 4 fails (under threshold), then success clears
        for _ in range(4):
            _login("alex@silent.app", "wrong")
        ok = _login("alex@silent.app", "demo1234")
        assert ok.status_code == 200
        # Now another 4 wrongs should also be allowed (counter cleared)
        for _ in range(4):
            assert _login("alex@silent.app", "wrong").status_code == 401
        # And we can still log in
        assert _login("alex@silent.app", "demo1234").status_code == 200


# ── Regex escape on search ──────────────────────────────────────────────────
class TestSearchEscape:
    @pytest.mark.parametrize("q", ["maya", ".*", "+155", "[a-z]", "(", "*", "\\", "."])
    def test_search_does_not_500(self, alex, q):
        r = requests.get(
            f"{API}/friends/search",
            params={"q": q},
            headers=_headers(alex["token"]),
            timeout=15,
        )
        assert r.status_code == 200, f"q={q!r} returned {r.status_code}: {r.text}"
        assert "results" in r.json()

    def test_search_finds_maya(self, alex):
        r = requests.get(
            f"{API}/friends/search",
            params={"q": "maya"},
            headers=_headers(alex["token"]),
            timeout=15,
        )
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()["results"]]
        assert "maya@silent.app" in emails


# ── Rooms include publicKey on members ──────────────────────────────────────
class TestRoomMembersPubkey:
    def _circle_id(self, headers):
        r = requests.get(f"{API}/rooms", headers=headers, timeout=15)
        for it in r.json()["items"]:
            if it["name"] == "Privacy Circle":
                return it["id"]
        pytest.fail("Privacy Circle not found")

    def test_members_have_pubkeys(self, alex):
        h = _headers(alex["token"])
        rid = self._circle_id(h)
        r = requests.get(f"{API}/rooms/{rid}", headers=h, timeout=15)
        assert r.status_code == 200
        room = r.json()
        assert room["type"] == "group"
        assert len(room["members"]) >= 3
        for m in room["members"]:
            assert m.get("publicKey"), f"member {m['name']} missing publicKey"


# ── Messages: NaCl per-recipient encryption ─────────────────────────────────
def _dm_room_id(headers, partner_name="Maya Tan"):
    r = requests.get(f"{API}/rooms", headers=headers, timeout=15)
    for it in r.json()["items"]:
        if it["name"] == partner_name and it["type"] == "dm":
            return it["id"]
    pytest.fail(f"DM with {partner_name} not found")


def _encrypt_for(recipients_pubkeys: dict, sender_sk, plaintext: str):
    """recipients_pubkeys: {user_id: pubkey_b64}. Returns encryptedFor dict."""
    out = {}
    for uid, pk_b64 in recipients_pubkeys.items():
        pk = nacl.public.PublicKey(pk_b64.encode(), nacl.encoding.Base64Encoder)
        box = nacl.public.Box(sender_sk, pk)
        nonce = nacl.utils.random(nacl.public.Box.NONCE_SIZE)
        ct = box.encrypt(plaintext.encode(), nonce).ciphertext
        out[uid] = {
            "ciphertext": nacl.encoding.Base64Encoder.encode(ct).decode(),
            "nonce": nacl.encoding.Base64Encoder.encode(nonce).decode(),
        }
    return out


class TestMessages:
    def test_send_and_get_returns_only_my_slice(self, alex, maya):
        h = _headers(alex["token"])
        rid = _dm_room_id(h)
        # fetch room members for pubkeys
        room = requests.get(f"{API}/rooms/{rid}", headers=h, timeout=15).json()
        pubkeys = {m["id"]: m["publicKey"] for m in room["members"]}
        alex_sk, alex_pk = _derive_keypair("alex@silent.app", "demo1234")
        plaintext = f"hello {uuid.uuid4().hex[:6]}"
        encrypted_for = _encrypt_for(pubkeys, alex_sk, plaintext)
        sender_pub = alex_pk.encode(nacl.encoding.Base64Encoder).decode()

        r = requests.post(
            f"{API}/messages",
            headers=h,
            json={
                "roomId": rid,
                "encryptedFor": encrypted_for,
                "senderPubKey": sender_pub,
                "ephemeral": False,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ciphertext"] == encrypted_for[alex["id"]]["ciphertext"]
        assert body["nonce"] == encrypted_for[alex["id"]]["nonce"]

        # GET as maya — she should see HER slice (different ciphertext)
        mh = _headers(maya["token"])
        listing = requests.get(f"{API}/messages", params={"roomId": rid}, headers=mh, timeout=15).json()
        last = listing["items"][-1]
        assert last["id"] == body["id"]
        assert last["ciphertext"] == encrypted_for[maya["id"]]["ciphertext"]
        # And maya should be able to decrypt to plaintext
        maya_sk, _ = _derive_keypair("maya@silent.app", "demo1234")
        sender_pk_obj = nacl.public.PublicKey(last["senderPubKey"].encode(), nacl.encoding.Base64Encoder)
        box = nacl.public.Box(maya_sk, sender_pk_obj)
        nonce = nacl.encoding.Base64Encoder.decode(last["nonce"].encode())
        ct = nacl.encoding.Base64Encoder.decode(last["ciphertext"].encode())
        decrypted = box.decrypt(ct, nonce).decode()
        assert decrypted == plaintext

    def test_400_when_sender_slice_missing(self, alex, maya):
        h = _headers(alex["token"])
        rid = _dm_room_id(h)
        room = requests.get(f"{API}/rooms/{rid}", headers=h, timeout=15).json()
        pubkeys = {m["id"]: m["publicKey"] for m in room["members"] if m["id"] != alex["id"]}
        alex_sk, alex_pk = _derive_keypair("alex@silent.app", "demo1234")
        encrypted_for = _encrypt_for(pubkeys, alex_sk, "x")
        sender_pub = alex_pk.encode(nacl.encoding.Base64Encoder).decode()
        r = requests.post(
            f"{API}/messages",
            headers=h,
            json={
                "roomId": rid,
                "encryptedFor": encrypted_for,  # no slice for alex
                "senderPubKey": sender_pub,
                "ephemeral": False,
            },
            timeout=15,
        )
        assert r.status_code == 400, r.text


# ── WebSocket ───────────────────────────────────────────────────────────────
class TestWebSocket:
    def test_bad_token_closes(self):
        """Connection must be rejected. Starlette returns HTTP 403 when close() is
        called before accept(); this is functionally equivalent to a 4401 close
        from the client's perspective (connection refused)."""
        async def run():
            try:
                async with websockets.connect(f"{WS_URL}?token=garbage", open_timeout=10) as ws:
                    await ws.recv()
                    return "received"  # should not happen
            except websockets.exceptions.ConnectionClosed as e:
                return ("closed", e.code)
            except Exception as e:
                return ("err", str(e))
        result = asyncio.run(run())
        # Either a 4401 close or an HTTP 403 rejection counts as auth failure
        assert result != "received", f"got {result}"
        if result[0] == "closed":
            assert result[1] == 4401
        else:
            assert "403" in result[1] or "401" in result[1], f"unexpected: {result}"

    def test_no_token_closes(self):
        async def run():
            try:
                async with websockets.connect(WS_URL, open_timeout=10) as ws:
                    await ws.recv()
                    return "received"
            except websockets.exceptions.ConnectionClosed as e:
                return ("closed", e.code)
            except Exception as e:
                return ("err", str(e))
        result = asyncio.run(run())
        assert result != "received"
        if result[0] == "closed":
            assert result[1] == 4401
        else:
            assert "403" in result[1] or "401" in result[1]

    def test_hello_and_pong(self, alex):
        async def run():
            async with websockets.connect(f"{WS_URL}?token={alex['token']}", open_timeout=10) as ws:
                hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert hello["type"] == "hello"
                assert hello["userId"] == alex["id"]
                await ws.send(json.dumps({"type": "ping"}))
                pong = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert pong["type"] == "pong"
        asyncio.run(run())

    def test_broadcast_on_message(self, alex, maya):
        """Open WS as alex; have maya post a message to alex<->maya DM; alex's WS receives it."""
        h_maya = _headers(maya["token"])
        rid = _dm_room_id(h_maya, partner_name="Alex Rivera")
        room = requests.get(f"{API}/rooms/{rid}", headers=h_maya, timeout=15).json()
        pubkeys = {m["id"]: m["publicKey"] for m in room["members"]}
        maya_sk, maya_pk = _derive_keypair("maya@silent.app", "demo1234")
        plaintext = f"broadcast-{uuid.uuid4().hex[:6]}"
        encrypted_for = _encrypt_for(pubkeys, maya_sk, plaintext)
        sender_pub = maya_pk.encode(nacl.encoding.Base64Encoder).decode()

        async def run():
            async with websockets.connect(f"{WS_URL}?token={alex['token']}", open_timeout=10) as ws:
                hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert hello["type"] == "hello"
                # Now POST as maya
                r = requests.post(
                    f"{API}/messages",
                    headers=h_maya,
                    json={
                        "roomId": rid,
                        "encryptedFor": encrypted_for,
                        "senderPubKey": sender_pub,
                        "ephemeral": False,
                    },
                    timeout=15,
                )
                assert r.status_code == 200, r.text
                # Receive WS push (allow up to 5s; might get extra messages)
                got = None
                for _ in range(3):
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                    if msg.get("type") == "message":
                        got = msg
                        break
                assert got is not None, "no message frame received"
                data = got["data"]
                assert data["roomId"] == rid
                assert data["senderId"] == maya["id"]
                # alex's slice should decrypt to plaintext
                alex_sk, _ = _derive_keypair("alex@silent.app", "demo1234")
                sender_pk_obj = nacl.public.PublicKey(data["senderPubKey"].encode(), nacl.encoding.Base64Encoder)
                box = nacl.public.Box(alex_sk, sender_pk_obj)
                nonce = nacl.encoding.Base64Encoder.decode(data["nonce"].encode())
                ct = nacl.encoding.Base64Encoder.decode(data["ciphertext"].encode())
                assert box.decrypt(ct, nonce).decode() == plaintext

        asyncio.run(run())
