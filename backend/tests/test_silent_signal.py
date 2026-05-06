import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://bug-squash-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def alex_token():
    r = requests.post(f"{API}/auth/login", json={"email": "alex@silent.app", "password": "demo1234"}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body and "user" in body
    assert body["user"]["email"] == "alex@silent.app"
    return body["access_token"]


@pytest.fixture(scope="module")
def alex_headers(alex_token):
    return {"Authorization": f"Bearer {alex_token}", "Content-Type": "application/json"}


# ---- AUTH ----
class TestAuth:
    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "alex@silent.app", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, alex_headers):
        r = requests.get(f"{API}/auth/me", headers=alex_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "alex@silent.app"

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={"email": "alex@silent.app", "password": "whatever1", "name": "x"}, timeout=15)
        assert r.status_code == 400

    def test_register_new_user(self):
        email = f"test_{uuid.uuid4().hex[:8]}@silent.app"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "demo1234", "name": "TEST User"}, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert "access_token" in b
        assert b["user"]["email"] == email


# ---- FRIENDS ----
class TestFriends:
    def test_friends_list_alex(self, alex_headers):
        r = requests.get(f"{API}/friends/list", headers=alex_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        accepted_names = [i["otherUser"]["name"] for i in items if i["status"] == "accepted"]
        assert "Maya Tan" in accepted_names
        assert "Jordan Kim" in accepted_names

    def test_friends_search(self, alex_headers):
        r = requests.get(f"{API}/friends/search?q=maya", headers=alex_headers, timeout=15)
        assert r.status_code == 200
        results = r.json()["results"]
        assert any("maya" in (u["email"] or "") for u in results)


# ---- ROOMS ----
class TestRooms:
    def test_rooms_list(self, alex_headers):
        r = requests.get(f"{API}/rooms", headers=alex_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        names = [i["name"] for i in items]
        assert "Privacy Circle" in names
        assert "Maya Tan" in names
        assert "Jordan Kim" in names

    def test_get_room(self, alex_headers):
        r = requests.get(f"{API}/rooms", headers=alex_headers, timeout=15)
        rid = next(i["id"] for i in r.json()["items"] if i["name"] == "Privacy Circle")
        r2 = requests.get(f"{API}/rooms/{rid}", headers=alex_headers, timeout=15)
        assert r2.status_code == 200
        room = r2.json()
        assert room["type"] == "group"
        assert room["inviteCode"] == "circle2026"

    def test_create_group(self, alex_headers):
        r = requests.post(f"{API}/rooms", headers=alex_headers, json={"name": f"TEST_{uuid.uuid4().hex[:6]}"}, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["type"] == "group"
        assert b["inviteCode"]

    def test_join_with_invite(self):
        # register a fresh user to join
        email = f"join_{uuid.uuid4().hex[:6]}@silent.app"
        reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "demo1234", "name": "TEST Join"}, timeout=15)
        token = reg.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r = requests.post(f"{API}/rooms/join", headers=h, json={"inviteCode": "circle2026"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["alreadyMember"] is False


# ---- MESSAGES ----
class TestMessages:
    def _circle_id(self, headers):
        r = requests.get(f"{API}/rooms", headers=headers, timeout=15)
        return next(i["id"] for i in r.json()["items"] if i["name"] == "Privacy Circle")

    def test_list_messages(self, alex_headers):
        rid = self._circle_id(alex_headers)
        r = requests.get(f"{API}/messages?roomId={rid}", headers=alex_headers, timeout=15)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_send_message_and_persist(self, alex_headers):
        rid = self._circle_id(alex_headers)
        body = {"roomId": rid, "ciphertext": "TEST_CT", "iv": "TEST_IV", "salt": "TEST_SALT", "ephemeral": False}
        r = requests.post(f"{API}/messages", headers=alex_headers, json=body, timeout=15)
        assert r.status_code == 200, r.text
        msg_id = r.json()["id"]
        r2 = requests.get(f"{API}/messages?roomId={rid}", headers=alex_headers, timeout=15)
        ids = [m["id"] for m in r2.json()["items"]]
        assert msg_id in ids

    def test_send_ephemeral(self, alex_headers):
        rid = self._circle_id(alex_headers)
        body = {"roomId": rid, "ciphertext": "TEST_E", "iv": "TEST_IV", "salt": "TEST_S", "ephemeral": True}
        r = requests.post(f"{API}/messages", headers=alex_headers, json=body, timeout=15)
        assert r.status_code == 200
        assert r.json()["ephemeral"] is True


# ---- PROFILE ----
class TestProfile:
    def test_update_profile(self, alex_headers):
        r = requests.patch(f"{API}/users/me", headers=alex_headers, json={"phone": "+15551110001"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["phone"] == "+15551110001"
