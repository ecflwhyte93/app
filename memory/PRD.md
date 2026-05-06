# Silent Signal — PRD

## Overview
Silent Signal is a dark, privacy-first encrypted messaging mobile app (Expo React Native) with a FastAPI + MongoDB backend. The app demonstrates end-to-end encrypted messaging where the server only ever stores ciphertext + iv + salt — never plaintext.

## Stack
- **Frontend**: Expo SDK 54, expo-router file-based navigation, `crypto-js` (AES-GCM-style demo), `expo-secure-store` for token persistence
- **Backend**: FastAPI, MongoDB (Motor), bcrypt + PyJWT
- **Auth**: JWT email/password (Bearer token + httpOnly cookie). Demo + admin users seeded.

## Brand
- Name: "Silent Signal", tagline: "Encrypted. Private. Yours."
- Palette: bg `#111111`, surface `#1A1A1A`, primary `#4ADE80`, border `#2D4A3E`, text `#F4F4F5`, muted `#8A9A84`

## Screens
1. **Landing** (`/`) — hero, features, CTA
2. **Auth** — `/login`, `/register`
3. **Tabs** — Chats, Friends, Settings
4. **Chat room** — `/chat/[roomId]` with vanishing-message toggle
5. **Modals** — create group, join group, add friend (in-screen modals)

## Backend endpoints (`/api/...`)
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Profile: `PATCH /users/me`
- Friends: `GET /friends/search`, `POST /friends/request`, `POST /friends/accept`, `POST /friends/decline`, `GET /friends/list`
- Rooms: `GET /rooms`, `GET /rooms/{id}`, `POST /rooms`, `POST /rooms/join`
- Messages: `GET /messages?roomId=`, `POST /messages`

## Encryption (demo-grade)
Client encrypts the plaintext using AES-256 (CryptoJS) with a key derived (PBKDF2) from a per-room passphrase + a random salt; iv random per message. Server stores only `{ciphertext, iv, salt, ephemeral}`. Ephemeral messages auto-delete after 2 minutes via MongoDB TTL index. NOTE: The shared passphrase is shipped in client code for the demo; production would require per-user keypairs.

## Seeded data
- Admin: `admin@silent.app` / `admin12345`
- Demo users: alex/maya/jordan @silent.app / `demo1234`
- Pre-existing DM rooms + a group room "Privacy Circle" (invite code `circle2026`)

## Business enhancement
The vanishing/ephemeral message toggle is the core monetizable feature: free tier gets 2-minute vanishing; a Pro tier can offer custom durations, group analytics for moderators, and per-message screenshot detection.
