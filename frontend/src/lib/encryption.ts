// Demo-grade end-to-end encryption helpers using crypto-js (AES-CBC + PBKDF2).
// Server stores only ciphertext + iv + salt — never plaintext. The shared
// passphrase is shipped in the client for demo purposes.
import CryptoJS from "crypto-js";

const SHARED_PASSPHRASE = "silent-signal-demo-key-v1";

function randomHex(bytes: number): string {
  const wa = CryptoJS.lib.WordArray.random(bytes);
  return CryptoJS.enc.Hex.stringify(wa);
}

export async function encryptMessage(plaintext: string): Promise<{
  ciphertext: string;
  iv: string;
  salt: string;
}> {
  const saltHex = randomHex(16);
  const ivHex = randomHex(16);
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const key = CryptoJS.PBKDF2(SHARED_PASSPHRASE, salt, {
    keySize: 256 / 32,
    iterations: 1000,
  });
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    ciphertext: encrypted.toString(), // base64
    iv: ivHex,
    salt: saltHex,
  };
}

export async function decryptMessage(
  ciphertext: string,
  ivHex: string,
  saltHex: string
): Promise<string> {
  try {
    const salt = CryptoJS.enc.Hex.parse(saltHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = CryptoJS.PBKDF2(SHARED_PASSPHRASE, salt, {
      keySize: 256 / 32,
      iterations: 1000,
    });
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plain = decrypted.toString(CryptoJS.enc.Utf8);
    return plain || "[unable to decrypt]";
  } catch {
    return "[unable to decrypt]";
  }
}
