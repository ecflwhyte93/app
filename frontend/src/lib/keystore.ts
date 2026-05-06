// Per-user mnemonic storage. Mnemonic stays on the device — the server never
// sees it. Stored in expo-secure-store on native; localStorage on web.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { KeyPair } from "./encryption";

const PREFIX = "silent_signal_mnemonic_";

function key(email: string): string {
  // Hyphens are not legal in SecureStore keys; replace with underscore.
  return PREFIX + email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

async function rawGet(k: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(k);
}

async function rawSet(k: string, v: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* noop */
    }
    return;
  }
  await SecureStore.setItemAsync(k, v);
}

async function rawDel(k: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* noop */
    }
    return;
  }
  await SecureStore.deleteItemAsync(k);
}

export const mnemonicStore = {
  get: (email: string) => rawGet(key(email)),
  set: (email: string, mnemonic: string) => rawSet(key(email), mnemonic),
  clear: (email: string) => rawDel(key(email)),
};

// In-memory cache for the active session's keypair.
let cached: KeyPair | null = null;

export const keystore = {
  set(kp: KeyPair) {
    cached = kp;
  },
  get(): KeyPair | null {
    return cached;
  },
  clear() {
    cached = null;
  },
};
