from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import json
import hashlib
import secrets
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Set, Literal

import bcrypt
import jwt
import nacl.public
import nacl.encoding
from bson import ObjectId
from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Depends,
    Request,
    Response,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ─── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("silent-signal")

# ─── DB ────────────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ─── Auth helpers ──────────────────────────────────────────────────────────
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days for mobile demo
LOGIN_MAX_FAILS = 5
LOGIN_LOCKOUT_MIN = 15
KEYPAIR_DOMAIN = "silent-signal-v1"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def derive_pubkey_b64(email: str, password: str) -> str:
    """Mirror of the client-side keypair derivation so seeded demo users have
    a known public key uploaded by the server. Secret = sha256(email:password:domain).
    """
    seed = hashlib.sha256(f"{email}:{password}:{KEYPAIR_DOMAIN}".encode("utf-8")).digest()
    sk = nacl.public.PrivateKey(seed)
    pk = sk.public_key
    return pk.encode(nacl.encoding.Base64Encoder).decode("ascii")


def decode_token(token: str) -> dict:
    payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("wrong type")
    return payload


def serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "name": doc.get("name"),
        "phone": doc.get("phone"),
        "publicKey": doc.get("public_key"),
        "keyMode": doc.get("key_mode", "password"),
        "role": doc.get("role", "user"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }


def create_access_token(user_id: str, email: str, token_version: int = 1) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "tv": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Validate token version — clients with stale tokens after a "logout
        # other devices" or password reset are evicted.
        token_tv = payload.get("tv", 1)
        user_tv = user.get("token_version", 1)
        if token_tv != user_tv:
            raise HTTPException(status_code=401, detail="Session has been revoked")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TTL_MIN * 60,
        path="/",
    )


# ─── Brute force lockout ───────────────────────────────────────────────────
async def _is_locked(identifier: str) -> Optional[datetime]:
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if not doc:
        return None
    locked_until = doc.get("locked_until")
    if locked_until:
        # Mongo returns naive datetimes; treat as UTC for comparison.
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            return locked_until
    return None


async def _record_login_failure(identifier: str) -> None:
    now = datetime.now(timezone.utc)
    doc = await db.login_attempts.find_one({"identifier": identifier})
    count = (doc.get("count", 0) if doc else 0) + 1
    update = {"count": count, "last_at": now}
    if count >= LOGIN_MAX_FAILS:
        update["locked_until"] = now + timedelta(minutes=LOGIN_LOCKOUT_MIN)
        update["count"] = 0  # reset after lockout window; lockout itself enforces wait
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$set": update},
        upsert=True,
    )


async def _clear_login_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})


# ─── Pydantic Models ───────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    keyMode: Literal["password", "phrase"] = "password"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class PublicKeyIn(BaseModel):
    publicKey: str = Field(min_length=10, max_length=128)


class FriendRequestIn(BaseModel):
    addresseeId: str


class FriendActionIn(BaseModel):
    friendId: str


class CreateRoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JoinRoomIn(BaseModel):
    inviteCode: str = Field(min_length=3, max_length=64)


class EncryptedSlice(BaseModel):
    ciphertext: str
    nonce: str


class SendMessageIn(BaseModel):
    roomId: str
    encryptedFor: Dict[str, EncryptedSlice]
    senderPubKey: str
    ephemeral: bool = False


# ─── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Silent Signal API")
api = APIRouter(prefix="/api")


# ─── Auth routes ───────────────────────────────────────────────────────────
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # For "phrase" mode the client owns the keypair and will upload its public
    # key via PUT /api/users/me/public-key right after register. For "password"
    # mode (legacy) we derive the public key deterministically from the
    # email/password pair so demo users work out of the box.
    public_key = derive_pubkey_b64(email, payload.password) if payload.keyMode == "password" else None
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "phone": None,
        "public_key": public_key,
        "key_mode": payload.keyMode,
        "token_version": 1,
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    user_id = str(res.inserted_id)
    token = create_access_token(user_id, email, 1)
    set_auth_cookie(response, token)
    doc["_id"] = res.inserted_id
    return {"user": serialize_user(doc), "access_token": token}


def _client_ip(request: Request) -> str:
    # Honor X-Forwarded-For first hop when behind ingress/proxy; fall back to
    # the raw transport address. Falls back to "unknown" if neither is set.
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower()
    ip = _client_ip(request)
    identifier = f"{ip}:{email}"

    locked_until = await _is_locked(identifier)
    if locked_until:
        wait = int((locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in ~{wait} min.",
        )

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await _record_login_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await _clear_login_attempts(identifier)
    token = create_access_token(str(user["_id"]), email, user.get("token_version", 1))
    set_auth_cookie(response, token)
    return {"user": serialize_user(user), "access_token": token}


@api.post("/auth/logout-all-other")
async def logout_all_other(response: Response, user=Depends(get_current_user)):
    """Invalidate every existing session for the current user except this one.
    Done by incrementing the user's `token_version` (every issued JWT carries
    that value as a `tv` claim). A fresh token for the current session is
    returned in the response body so the caller can swap their stored token."""
    new_version = user.get("token_version", 1) + 1
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"token_version": new_version}})
    new_token = create_access_token(str(user["_id"]), user["email"], new_version)
    set_auth_cookie(response, new_token)
    refreshed = await db.users.find_one({"_id": user["_id"]})
    return {"user": serialize_user(refreshed), "access_token": new_token}


@api.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn, request: Request):
    """Always returns 200 (don't leak account existence). If the user exists,
    creates a single-use token stored in `password_reset_tokens` with 1-hour
    expiry and logs the reset link. Since this environment has no email
    transport, the token is also echoed back as `demo_link` for demo purposes.
    """
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    origin = request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")
    demo_link = None
    if user:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": str(user["_id"]),
            "email": email,
            "created_at": now,
            "expires_at": now + timedelta(hours=1),
            "used": False,
        })
        link = f"{origin}/reset-password?token={token}" if origin else f"/reset-password?token={token}"
        logger.info("Password reset link for %s: %s", email, link)
        demo_link = link
    return {"ok": True, "demo_link": demo_link}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    doc = await db.password_reset_tokens.find_one({"token": payload.token})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if doc.get("used"):
        raise HTTPException(status_code=400, detail="This reset token has already been used")
    expires_at = doc.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset token has expired")

    try:
        uid = ObjectId(doc["user_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user reference")
    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=400, detail="Account no longer exists")

    # If the account uses password-derived keys (legacy), the new password
    # implies a brand new keypair — recompute and store the public key.
    # If the account uses a recovery phrase, the keypair is decoupled from the
    # password, so we DO NOT touch public_key. Encrypted history stays readable.
    update_fields = {
        "password_hash": hash_password(payload.new_password),
        "token_version": user.get("token_version", 1) + 1,
    }
    key_mode = user.get("key_mode", "password")
    if key_mode == "password":
        update_fields["public_key"] = derive_pubkey_b64(user["email"], payload.new_password)
    await db.users.update_one({"_id": uid}, {"$set": update_fields})
    await db.password_reset_tokens.update_one(
        {"_id": doc["_id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}},
    )
    # Clear any brute-force lockouts for this email as well.
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{re.escape(user['email'])}$"}})
    return {"ok": True, "keyMode": key_mode}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": serialize_user(user)}


@api.put("/users/me/public-key")
async def upload_pubkey(payload: PublicKeyIn, user=Depends(get_current_user)):
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"public_key": payload.publicKey}},
    )
    return {"ok": True}


@api.patch("/users/me")
async def update_me(payload: UpdateProfileIn, user=Depends(get_current_user)):
    updates = {}
    if payload.name is not None and payload.name.strip():
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        updates["phone"] = payload.phone.strip() or None
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user = await db.users.find_one({"_id": user["_id"]})
    return {"user": serialize_user(user)}


# ─── Friends ───────────────────────────────────────────────────────────────
async def _user_brief(uid_str: str) -> dict:
    try:
        u = await db.users.find_one({"_id": ObjectId(uid_str)})
    except Exception:
        u = None
    if not u:
        return {"id": uid_str, "name": "Unknown", "email": None, "phone": None, "publicKey": None}
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "publicKey": u.get("public_key"),
    }


@api.get("/friends/search")
async def search_friends(q: str = Query(..., min_length=1), user=Depends(get_current_user)):
    safe = re.escape(q.strip())
    if not safe:
        return {"results": []}
    regex = {"$regex": safe, "$options": "i"}
    cursor = db.users.find(
        {
            "$and": [
                {"_id": {"$ne": user["_id"]}},
                {"$or": [{"name": regex}, {"email": regex}, {"phone": regex}]},
            ]
        }
    ).limit(20)
    results = []
    async for u in cursor:
        results.append({
            "id": str(u["_id"]),
            "name": u.get("name"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "publicKey": u.get("public_key"),
        })
    return {"results": results}


async def _get_or_create_dm_room(user_a_id: str, user_b_id: str) -> dict:
    members_sorted = sorted([user_a_id, user_b_id])
    existing = await db.rooms.find_one({"type": "dm", "members": members_sorted})
    if existing:
        return existing
    doc = {
        "name": "Direct Message",
        "type": "dm",
        "inviteCode": None,
        "createdBy": user_a_id,
        "members": members_sorted,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.rooms.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


@api.post("/friends/request")
async def friend_request(payload: FriendRequestIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    if payload.addresseeId == me_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    try:
        target_oid = ObjectId(payload.addresseeId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    target = await db.users.find_one({"_id": target_oid})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.friends.find_one({
        "$or": [
            {"requesterId": me_id, "addresseeId": payload.addresseeId},
            {"requesterId": payload.addresseeId, "addresseeId": me_id},
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")

    doc = {
        "requesterId": me_id,
        "addresseeId": payload.addresseeId,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.friends.insert_one(doc)
    return {"id": str(res.inserted_id), "status": "pending"}


@api.post("/friends/accept")
async def friend_accept(payload: FriendActionIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    try:
        fid = ObjectId(payload.friendId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid friend id")
    f = await db.friends.find_one({"_id": fid})
    if not f or f["addresseeId"] != me_id:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if f["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already handled")
    await db.friends.update_one({"_id": fid}, {"$set": {"status": "accepted"}})
    await _get_or_create_dm_room(f["requesterId"], me_id)
    return {"ok": True}


@api.post("/friends/decline")
async def friend_decline(payload: FriendActionIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    try:
        fid = ObjectId(payload.friendId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid friend id")
    f = await db.friends.find_one({"_id": fid})
    if not f or f["addresseeId"] != me_id:
        raise HTTPException(status_code=404, detail="Friend request not found")
    await db.friends.update_one({"_id": fid}, {"$set": {"status": "declined"}})
    return {"ok": True}


@api.get("/friends/list")
async def friends_list(user=Depends(get_current_user)):
    me_id = str(user["_id"])
    cursor = db.friends.find({"$or": [{"requesterId": me_id}, {"addresseeId": me_id}]})
    items = []
    async for f in cursor:
        is_requester = f["requesterId"] == me_id
        other_id = f["addresseeId"] if is_requester else f["requesterId"]
        items.append({
            "id": str(f["_id"]),
            "status": f["status"],
            "isRequester": is_requester,
            "otherUser": await _user_brief(other_id),
            "created_at": f["created_at"].isoformat(),
        })
    return {"items": items}


# ─── Rooms ─────────────────────────────────────────────────────────────────
async def _last_message(room_id: str) -> Optional[dict]:
    msg = await db.messages.find_one({"roomId": room_id}, sort=[("created_at", -1)])
    if not msg:
        return None
    return {
        "id": str(msg["_id"]),
        "senderId": msg["senderId"],
        "senderName": (await _user_brief(msg["senderId"]))["name"],
        "createdAt": msg["created_at"].isoformat(),
        "ephemeral": msg.get("ephemeral", False),
    }


def _room_display_name(room: dict, me_id: str, others: dict) -> str:
    if room["type"] == "dm":
        for m in room["members"]:
            if m != me_id:
                return others.get(m, "Direct Message")
        return "Direct Message"
    return room.get("name", "Group")


@api.get("/rooms")
async def list_rooms(user=Depends(get_current_user)):
    me_id = str(user["_id"])
    cursor = db.rooms.find({"members": me_id}).sort("created_at", -1)
    rooms = []
    async for r in cursor:
        others_map = {}
        if r["type"] == "dm":
            for m in r["members"]:
                if m != me_id:
                    others_map[m] = (await _user_brief(m))["name"] or "Unknown"
        last = await _last_message(str(r["_id"]))
        rooms.append({
            "id": str(r["_id"]),
            "name": _room_display_name(r, me_id, others_map),
            "type": r["type"],
            "inviteCode": r.get("inviteCode"),
            "memberCount": len(r["members"]),
            "lastMessage": last,
            "createdAt": r["created_at"].isoformat(),
        })
    rooms.sort(key=lambda x: (x["lastMessage"]["createdAt"] if x["lastMessage"] else x["createdAt"]), reverse=True)
    return {"items": rooms}


@api.get("/rooms/{room_id}")
async def get_room(room_id: str, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    try:
        rid = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room id")
    r = await db.rooms.find_one({"_id": rid})
    if not r or me_id not in r["members"]:
        raise HTTPException(status_code=404, detail="Room not found")
    others_map = {}
    members = []
    for m in r["members"]:
        brief = await _user_brief(m)
        members.append(brief)
        if m != me_id:
            others_map[m] = brief["name"] or "Unknown"
    return {
        "id": str(r["_id"]),
        "name": _room_display_name(r, me_id, others_map),
        "type": r["type"],
        "inviteCode": r.get("inviteCode"),
        "members": members,
        "createdAt": r["created_at"].isoformat(),
    }


@api.post("/rooms")
async def create_room(payload: CreateRoomIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    code = secrets.token_urlsafe(8)[:12].replace("-", "").replace("_", "")
    while await db.rooms.find_one({"inviteCode": code}):
        code = secrets.token_urlsafe(8)[:12].replace("-", "").replace("_", "")
    doc = {
        "name": payload.name.strip(),
        "type": "group",
        "inviteCode": code,
        "createdBy": me_id,
        "members": [me_id],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.rooms.insert_one(doc)
    return {"id": str(res.inserted_id), "name": doc["name"], "inviteCode": code, "type": "group"}


@api.post("/rooms/join")
async def join_room(payload: JoinRoomIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    r = await db.rooms.find_one({"inviteCode": payload.inviteCode.strip()})
    if not r:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if me_id in r["members"]:
        return {"id": str(r["_id"]), "alreadyMember": True}
    await db.rooms.update_one({"_id": r["_id"]}, {"$push": {"members": me_id}})
    return {"id": str(r["_id"]), "alreadyMember": False}


# ─── WebSocket connection manager ──────────────────────────────────────────
class ConnectionManager:
    def __init__(self) -> None:
        self.connections: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self.lock:
            self.connections.setdefault(user_id, set()).add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self.lock:
            conns = self.connections.get(user_id)
            if conns and ws in conns:
                conns.remove(ws)
                if not conns:
                    self.connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        conns = list(self.connections.get(user_id, set()))
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                # silently drop; client will reconnect
                pass


manager = ConnectionManager()


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.close(code=4401)
        return
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.accept()
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        # send hello
        await websocket.send_text(json.dumps({"type": "hello", "userId": user_id}))
        while True:
            # client may send keepalives; we just discard them
            msg = await websocket.receive_text()
            try:
                parsed = json.loads(msg)
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)


def _build_message_for(viewer_id: str, doc: dict, sender_name: str) -> dict:
    """Slice a stored message for a particular recipient."""
    encrypted_for = doc.get("encryptedFor", {})
    slice_ = encrypted_for.get(viewer_id) or {"ciphertext": "", "nonce": ""}
    return {
        "id": str(doc["_id"]),
        "roomId": doc["roomId"],
        "senderId": doc["senderId"],
        "senderName": sender_name,
        "senderPubKey": doc.get("senderPubKey"),
        "ciphertext": slice_["ciphertext"],
        "nonce": slice_["nonce"],
        "ephemeral": doc.get("ephemeral", False),
        "createdAt": doc["created_at"].isoformat(),
    }


# ─── Messages ──────────────────────────────────────────────────────────────
@api.get("/messages")
async def list_messages(roomId: str, limit: int = 100, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    try:
        rid = ObjectId(roomId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room id")
    r = await db.rooms.find_one({"_id": rid})
    if not r or me_id not in r["members"]:
        raise HTTPException(status_code=404, detail="Room not found")

    now = datetime.now(timezone.utc)
    await db.messages.delete_many({"roomId": roomId, "expiresAt": {"$lte": now}})

    cursor = db.messages.find({"roomId": roomId}).sort("created_at", 1).limit(limit)
    items = []
    async for m in cursor:
        sender_name = (await _user_brief(m["senderId"]))["name"]
        items.append(_build_message_for(me_id, m, sender_name))
    return {"items": items}


@api.post("/messages")
async def send_message(payload: SendMessageIn, user=Depends(get_current_user)):
    me_id = str(user["_id"])
    try:
        rid = ObjectId(payload.roomId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room id")
    r = await db.rooms.find_one({"_id": rid})
    if not r or me_id not in r["members"]:
        raise HTTPException(status_code=404, detail="Room not found")

    member_set = set(r["members"])
    encrypted_for = {k: v.dict() for k, v in payload.encryptedFor.items() if k in member_set}
    if me_id not in encrypted_for:
        raise HTTPException(
            status_code=400,
            detail="encryptedFor must include a slice for the sender",
        )
    if not all(k in encrypted_for for k in member_set):
        # Missing slice for one or more members (their pubkey may not be available).
        # Deliver to only those we have slices for; others won't be able to read this message.
        # We just log and continue.
        missing = member_set - encrypted_for.keys()
        logger.info("send_message: room=%s missing slices for %s", payload.roomId, missing)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=2) if payload.ephemeral else None
    doc = {
        "roomId": payload.roomId,
        "senderId": me_id,
        "senderPubKey": payload.senderPubKey,
        "encryptedFor": encrypted_for,
        "ephemeral": payload.ephemeral,
        "expiresAt": expires_at,
        "created_at": now,
    }
    res = await db.messages.insert_one(doc)
    doc["_id"] = res.inserted_id

    sender_name = user.get("name") or "Unknown"

    # Broadcast over WebSocket to every room member that has an active connection
    for member_id in member_set:
        try:
            slice_msg = _build_message_for(member_id, doc, sender_name)
            await manager.send_to_user(member_id, {"type": "message", "data": slice_msg})
        except Exception as e:
            logger.warning("ws broadcast error for %s: %s", member_id, e)

    # Echo back the sender's slice for the HTTP response
    return _build_message_for(me_id, doc, sender_name)


# ─── Health ────────────────────────────────────────────────────────────────
@api.get("/")
async def root():
    return {"message": "Silent Signal API", "ok": True}


# ─── Mount + CORS ──────────────────────────────────────────────────────────
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Startup: indexes + seed demo data ─────────────────────────────────────
async def _seed_demo() -> None:
    demo_users = [
        {"email": "alex@silent.app", "password": "demo1234", "name": "Alex Rivera", "phone": "+15551110001"},
        {"email": "maya@silent.app", "password": "demo1234", "name": "Maya Tan", "phone": "+15551110002"},
        {"email": "jordan@silent.app", "password": "demo1234", "name": "Jordan Kim", "phone": "+15551110003"},
    ]
    ids: dict[str, str] = {}
    for u in demo_users:
        email = u["email"].lower()
        public_key = derive_pubkey_b64(email, u["password"])
        existing = await db.users.find_one({"email": email})
        if existing:
            # Ensure public key is set/up-to-date
            if existing.get("public_key") != public_key:
                await db.users.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"public_key": public_key}},
                )
            ids[email] = str(existing["_id"])
            continue
        doc = {
            "email": email,
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "phone": u["phone"],
            "public_key": public_key,
            "key_mode": "password",
            "token_version": 1,
            "role": "user",
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.users.insert_one(doc)
        ids[email] = str(res.inserted_id)

    # admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@silent.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin12345")
    admin_pk = derive_pubkey_b64(admin_email, admin_password)
    admin = await db.users.find_one({"email": admin_email})
    if admin is None:
        doc = {
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "phone": None,
            "public_key": admin_pk,
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.users.insert_one(doc)
        ids[admin_email] = str(res.inserted_id)
    else:
        if not verify_password(admin_password, admin.get("password_hash", "")):
            await db.users.update_one(
                {"_id": admin["_id"]},
                {"$set": {"password_hash": hash_password(admin_password), "public_key": admin_pk}},
            )
        elif admin.get("public_key") != admin_pk:
            await db.users.update_one({"_id": admin["_id"]}, {"$set": {"public_key": admin_pk}})
        ids[admin_email] = str(admin["_id"])

    pairs = [
        (ids["alex@silent.app"], ids["maya@silent.app"], "accepted"),
        (ids["alex@silent.app"], ids["jordan@silent.app"], "accepted"),
        (ids["maya@silent.app"], ids["jordan@silent.app"], "pending"),
    ]
    for req, addr, status in pairs:
        existing = await db.friends.find_one({
            "$or": [
                {"requesterId": req, "addresseeId": addr},
                {"requesterId": addr, "addresseeId": req},
            ]
        })
        if not existing:
            await db.friends.insert_one({
                "requesterId": req,
                "addresseeId": addr,
                "status": status,
                "created_at": datetime.now(timezone.utc),
            })

    for a, b, status in pairs:
        if status == "accepted":
            await _get_or_create_dm_room(a, b)

    group = await db.rooms.find_one({"type": "group", "name": "Privacy Circle"})
    if not group:
        code = "circle2026"
        await db.rooms.insert_one({
            "name": "Privacy Circle",
            "type": "group",
            "inviteCode": code,
            "createdBy": ids["alex@silent.app"],
            "members": [ids["alex@silent.app"], ids["maya@silent.app"], ids["jordan@silent.app"]],
            "created_at": datetime.now(timezone.utc),
        })


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.friends.create_index([("requesterId", 1), ("addresseeId", 1)])
    await db.rooms.create_index("inviteCode")
    await db.rooms.create_index("members")
    await db.messages.create_index([("roomId", 1), ("created_at", 1)])
    await db.messages.create_index("expiresAt", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    # One-shot migration: drop legacy messages with old schema (had `ciphertext` field at root level).
    # New schema stores `encryptedFor` map.
    legacy = await db.messages.delete_many({"ciphertext": {"$exists": True}})
    if legacy.deleted_count:
        logger.info("Dropped %d legacy messages (old encryption schema)", legacy.deleted_count)

    await _seed_demo()
    logger.info("Silent Signal API ready (E2E NaCl + WebSocket)")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
