function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Default shared passphrase for demo (in production, this would be exchanged securely)
const DEFAULT_PASSPHRASE = "ciphervault-shared-secret-2025";

export async function deriveKey(
  passphrase: string = DEFAULT_PASSPHRASE,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  // Cast salt buffer to satisfy TypeScript
  const saltBuffer = salt.buffer as ArrayBuffer;
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(saltBuffer),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  plaintext: string,
  passphrase?: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  salt: string,
  passphrase?: string
): Promise<string> {
  try {
    const saltBytes = new Uint8Array(base64ToArrayBuffer(salt));
    const key = await deriveKey(passphrase, saltBytes);
    const ivBytes = new Uint8Array(base64ToArrayBuffer(iv));
    const cipherBytes = new Uint8Array(base64ToArrayBuffer(ciphertext));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      cipherBytes
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[Unable to decrypt message]";
  }
}
