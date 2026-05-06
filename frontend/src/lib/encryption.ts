// E2E encryption for Silent Signal — NaCl box (Curve25519 + XSalsa20-Poly1305).
// Two key-derivation modes:
//   1. "phrase" — keypair seed = sha256(mnemonic + ":mnemonic-seed-v1") where the
//      mnemonic is a 24-word BIP39 phrase chosen at signup. Decoupled from the
//      password, so password resets don't lose message history.
//   2. "password" — legacy: seed = sha256(`${email}:${password}:silent-signal-v1`).
//      Kept for backward compat with the seeded demo accounts.
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import CryptoJS from "crypto-js";
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const KEYPAIR_DOMAIN = "silent-signal-v1";
export const MNEMONIC_DOMAIN = "mnemonic-seed-v1";

export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

function hashToBytes(input: string): Uint8Array {
  const hash = CryptoJS.SHA256(input);
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

export function deriveSeedFromPassword(email: string, password: string): Uint8Array {
  return hashToBytes(`${email.toLowerCase()}:${password}:${KEYPAIR_DOMAIN}`);
}

export function deriveKeyPairFromPassword(email: string, password: string): KeyPair {
  return nacl.box.keyPair.fromSecretKey(deriveSeedFromPassword(email, password));
}

export function deriveSeedFromMnemonic(mnemonic: string): Uint8Array {
  // Normalize whitespace
  const cleaned = mnemonic.trim().toLowerCase().split(/\s+/).join(" ");
  return hashToBytes(`${cleaned}:${MNEMONIC_DOMAIN}`);
}

export function deriveKeyPairFromMnemonic(mnemonic: string): KeyPair {
  return nacl.box.keyPair.fromSecretKey(deriveSeedFromMnemonic(mnemonic));
}

export function generateRecoveryPhrase(): string {
  // 256-bit entropy → 24 words.
  return generateMnemonic(wordlist, 256);
}

export function isValidRecoveryPhrase(phrase: string): boolean {
  try {
    return validateMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(" "), wordlist);
  } catch {
    return false;
  }
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
