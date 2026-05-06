// In-memory cache for the user's nacl keypair. Set on login/register and cleared on logout.
import type { KeyPair } from "./encryption";

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
