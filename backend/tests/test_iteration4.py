"""Iteration 4: token versioning + key-mode + recovery-phrase tests."""
import os
import uuid
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)


# ── keyMode ─────────────────────────────────────────────────────────────────
class TestKeyMode:
    def test_seeded_user_is_password_mode(self):
        r = login("alex@silent.app", "demo1234")
        assert r.status_code == 200, r.text
        tok = r.json()["access_token"]
        me = requests.get(f"{API}/auth/me", headers=H(tok), timeout=15)
        assert me.status_code == 200
        assert me.json()["user"].get("keyMode") == "password"
        assert me.json()["user"].get("publicKey")

    def test_register_phrase_mode_has_null_publickey(self):
        email = f"phrasetest+{uuid.uuid4().hex[:8]}@silent.app"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "phrase123", "name": "Phrase User", "keyMode": "phrase"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["keyMode"] == "phrase"
        assert body["user"]["publicKey"] is None
        # me also reports null
        me = requests.get(f"{API}/auth/me", headers=H(body["access_token"]), timeout=15).json()
        assert me["user"]["publicKey"] is None
        assert me["user"]["keyMode"] == "phrase"

    def test_upload_pubkey_reflects_in_me(self):
        email = f"phrasetest+{uuid.uuid4().hex[:8]}@silent.app"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "phrase123", "name": "PK Up", "keyMode": "phrase"},
            timeout=20,
        ).json()
        tok = r["access_token"]
        fake_pk = "A" * 44  # any 44-char base64-ish stub
        upd = requests.put(f"{API}/users/me/public-key", headers=H(tok), json={"publicKey": fake_pk}, timeout=15)
        assert upd.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=H(tok), timeout=15).json()
        assert me["user"]["publicKey"] == fake_pk


# ── token_version / logout-all-other ────────────────────────────────────────
class TestLogoutAllOther:
    def test_logout_all_other_revokes_old_token(self):
        # use a fresh user so we don't interfere with alex's state
        email = f"tv+{uuid.uuid4().hex[:8]}@silent.app"
        reg = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "pw123456", "name": "TV", "keyMode": "phrase"},
            timeout=20,
        ).json()
        old_tok = reg["access_token"]
        # old token works
        assert requests.get(f"{API}/auth/me", headers=H(old_tok), timeout=15).status_code == 200
        # call logout-all-other with old token
        r = requests.post(f"{API}/auth/logout-all-other", headers=H(old_tok), timeout=15)
        assert r.status_code == 200, r.text
        new_tok = r.json()["access_token"]
        assert new_tok and new_tok != old_tok
        # NEW token works
        assert requests.get(f"{API}/auth/me", headers=H(new_tok), timeout=15).status_code == 200
        # OLD token must now be 401 with "revoked" message
        old = requests.get(f"{API}/auth/me", headers=H(old_tok), timeout=15)
        assert old.status_code == 401
        assert "revoked" in old.json().get("detail", "").lower()


# ── reset-password: token_version + keypair behavior by mode ────────────────
class TestResetPassword:
    def _forgot_reset(self, email, new_pw):
        f = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15).json()
        link = f.get("demo_link") or ""
        token = link.split("token=")[-1]
        assert token, f"no reset token in {f}"
        r = requests.post(
            f"{API}/auth/reset-password",
            json={"token": token, "new_password": new_pw},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_reset_revokes_old_token(self):
        email = f"reset+{uuid.uuid4().hex[:8]}@silent.app"
        reg = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "pw123456", "name": "R", "keyMode": "phrase"},
            timeout=20,
        ).json()
        old_tok = reg["access_token"]
        assert requests.get(f"{API}/auth/me", headers=H(old_tok), timeout=15).status_code == 200
        self._forgot_reset(email, "newpw1234")
        # old token rejected
        r = requests.get(f"{API}/auth/me", headers=H(old_tok), timeout=15)
        assert r.status_code == 401

    def test_reset_preserves_pubkey_for_phrase_mode(self):
        email = f"phrm+{uuid.uuid4().hex[:8]}@silent.app"
        reg = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "pw123456", "name": "P", "keyMode": "phrase"},
            timeout=20,
        ).json()
        tok = reg["access_token"]
        fake_pk = "PHRASEMODEPUBKEYxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        requests.put(f"{API}/users/me/public-key", headers=H(tok), json={"publicKey": fake_pk}, timeout=15)
        out = self._forgot_reset(email, "newpw1234")
        assert out.get("keyMode") == "phrase"
        # log in with new password
        r = login(email, "newpw1234")
        assert r.status_code == 200
        new_user = r.json()["user"]
        assert new_user["publicKey"] == fake_pk, "phrase-mode reset must preserve publicKey"

    def test_reset_rotates_pubkey_for_password_mode(self):
        # use a fresh password-mode user (don't disturb seeded alex)
        email = f"pwm+{uuid.uuid4().hex[:8]}@silent.app"
        reg = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "pw123456", "name": "PW", "keyMode": "password"},
            timeout=20,
        ).json()
        old_pk = reg["user"]["publicKey"]
        assert old_pk
        out = self._forgot_reset(email, "differentpw9")
        assert out.get("keyMode") == "password"
        r = login(email, "differentpw9")
        assert r.status_code == 200
        new_pk = r.json()["user"]["publicKey"]
        assert new_pk and new_pk != old_pk, "password-mode reset must rotate publicKey"
