// E2E encryption for Silent Signal — NaCl box (Curve25519 + XSalsa20-Poly1305).
// Each user has a Curve25519 keypair. Messages are encrypted *per recipient*.
//
// Key derivation: secret = sha256(`${email}:${password}:silent-signal-v1`).
// This makes the keypair reproducible from the user's password on any device,
// while keeping the secret away from the server (the server stores only the
// public key uploaded by the client).
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import CryptoJS from "crypto-js";

export const KEYPAIR_DOMAIN = "silent-signal-v1";

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

export function deriveSeed(email: string, password: string): Uint8Array {
  const hash = CryptoJS.SHA256(`${email.toLowerCase()}:${password}:${KEYPAIR_DOMAIN}`);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const w = hash.words[i];
    bytes[i * 4] = (w >>> 24) & 0xff;
    bytes[i * 4 + 1] = (w >>> 16) & 0xff;
    bytes[i * 4 + 2] = (w >>> 8) & 0xff;
    bytes[i * 4 + 3] = w & 0xff;
  }
  return bytes;
}

export function deriveKeyPair(email: string, password: string): KeyPair {
  return nacl.box.keyPair.fromSecretKey(deriveSeed(email, password));
}

export function publicKeyToB64(pk: Uint8Array): string {
  return naclUtil.encodeBase64(pk);
}

export function publicKeyFromB64(b64: string): Uint8Array {
  return naclUtil.decodeBase64(b64);
}

export type EncryptedSlice = { ciphertext: string; nonce: string };

export function encryptForRecipient(
  plaintext: string,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array
): EncryptedSlice {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = naclUtil.decodeUTF8(plaintext);
  const cipher = nacl.box(msg, nonce, theirPublicKey, mySecretKey);
  return {
    ciphertext: naclUtil.encodeBase64(cipher),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

export function decryptFromSender(
  slice: EncryptedSlice,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array
): string | null {
  try {
    const cipher = naclUtil.decodeBase64(slice.ciphertext);
    const nonce = naclUtil.decodeBase64(slice.nonce);
    const out = nacl.box.open(cipher, nonce, theirPublicKey, mySecretKey);
    if (!out) return null;
    return naclUtil.encodeUTF8(out);
  } catch {
    return null;
  }
}
