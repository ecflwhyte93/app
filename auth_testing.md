# Silent Signal — Auth Testing Playbook

JWT email/password auth, FastAPI + MongoDB. Mobile uses Bearer tokens; web parity via httpOnly cookie.

## 1. MongoDB sanity
```
mongosh
use silent_signal
db.users.findOne({email: "admin@silent.app"})    // password_hash should start with $2b$
db.users.getIndexes()                              // unique index on email
db.messages.getIndexes()                           // TTL index on expiresAt
```

## 2. Register + login
```bash
BASE=http://localhost:8001/api

# register
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"new@silent.app","password":"newpass1","name":"New User"}'

# login (existing demo user)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@silent.app","password":"demo1234"}' | jq -r .access_token)
echo $TOKEN

# me
curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN"
```

## 3. Negative paths (must fail)
- Register with taken email → 400
- Login with wrong password → 401
- `GET /api/auth/me` without Authorization → 401
- `GET /api/auth/me` with malformed token → 401

## 4. Friends/Rooms/Messages happy path
```bash
# list friends
curl -s $BASE/friends/list -H "Authorization: Bearer $TOKEN"

# rooms
curl -s $BASE/rooms -H "Authorization: Bearer $TOKEN"

# join the seeded group via invite code
curl -s -X POST $BASE/rooms/join -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"inviteCode":"circle2026"}'
```
