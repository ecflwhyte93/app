import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStorage } from "../lib/api";
import {
  deriveKeyPairFromPassword,
  deriveKeyPairFromMnemonic,
  generateRecoveryPhrase,
  publicKeyToB64,
} from "../lib/encryption";
import { keystore, mnemonicStore } from "../lib/keystore";

export type SSUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  publicKey: string | null;
  keyMode: "password" | "phrase";
  role: string;
};

type AuthState = {
  user: SSUser | null;
  loading: boolean;
  /** True when the logged-in user is in phrase mode but their mnemonic isn't on this device yet. */
  needsRecoveryPhrase: boolean;
  login: (email: string, password: string) => Promise<{ needsPhrase: boolean }>;
  /** Generates a fresh 24-word phrase, registers the account in phrase mode and returns the phrase. */
  registerWithPhrase: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ phrase: string }>;
  /** Provide the recovery phrase from another device to unlock the keypair. */
  applyRecoveryPhrase: (phrase: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutOtherDevices: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SSUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRecoveryPhrase, setNeedsRecoveryPhrase] = useState(false);

  const ensureKeypairOnLogin = useCallback(async (u: SSUser, password: string) => {
    if (u.keyMode === "password") {
      const kp = deriveKeyPairFromPassword(u.email, password);
      keystore.set(kp);
      try {
        await api("/users/me/public-key", {
          method: "PUT",
          body: { publicKey: publicKeyToB64(kp.publicKey) },
        });
      } catch {
        /* non-fatal */
      }
      setNeedsRecoveryPhrase(false);
      return;
    }
    // phrase mode
    const stored = await mnemonicStore.get(u.email);
    if (stored) {
      const kp = deriveKeyPairFromMnemonic(stored);
      keystore.set(kp);
      try {
        await api("/users/me/public-key", {
          method: "PUT",
          body: { publicKey: publicKeyToB64(kp.publicKey) },
        });
      } catch {
        /* non-fatal */
      }
      setNeedsRecoveryPhrase(false);
    } else {
      keystore.clear();
      setNeedsRecoveryPhrase(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await tokenStorage.get();
      if (!token) {
        setUser(null);
        setNeedsRecoveryPhrase(false);
        return;
      }
      const data = await api<{ user: SSUser }>("/auth/me");
      setUser(data.user);
      // We can only re-derive keypair on cold-start for phrase users (we have
      // their mnemonic on disk). Password users need to log in again.
      if (data.user.keyMode === "phrase" && !keystore.get()) {
        const stored = await mnemonicStore.get(data.user.email);
        if (stored) {
          keystore.set(deriveKeyPairFromMnemonic(stored));
          setNeedsRecoveryPhrase(false);
        } else {
          setNeedsRecoveryPhrase(true);
        }
      }
    } catch {
      setUser(null);
      setNeedsRecoveryPhrase(false);
      await tokenStorage.clear();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ user: SSUser; access_token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      await tokenStorage.set(data.access_token);
      await ensureKeypairOnLogin(data.user, password);
      // re-fetch to pick up any pubkey side-effects
      try {
        const me = await api<{ user: SSUser }>("/auth/me");
        setUser(me.user);
        return { needsPhrase: me.user.keyMode === "phrase" && !keystore.get() };
      } catch {
        setUser(data.user);
        return { needsPhrase: data.user.keyMode === "phrase" && !keystore.get() };
      }
    },
    [ensureKeypairOnLogin]
  );

  const registerWithPhrase = useCallback(
    async (email: string, password: string, name: string) => {
      const phrase = generateRecoveryPhrase();
      const data = await api<{ user: SSUser; access_token: string }>("/auth/register", {
        method: "POST",
        body: { email, password, name, keyMode: "phrase" },
        auth: false,
      });
      await tokenStorage.set(data.access_token);
      await mnemonicStore.set(email.toLowerCase(), phrase);
      const kp = deriveKeyPairFromMnemonic(phrase);
      keystore.set(kp);
      try {
        await api("/users/me/public-key", {
          method: "PUT",
          body: { publicKey: publicKeyToB64(kp.publicKey) },
        });
      } catch {
        /* non-fatal */
      }
      try {
        const me = await api<{ user: SSUser }>("/auth/me");
        setUser(me.user);
      } catch {
        setUser(data.user);
      }
      setNeedsRecoveryPhrase(false);
      return { phrase };
    },
    []
  );

  const applyRecoveryPhrase = useCallback(
    async (phrase: string) => {
      if (!user) throw new Error("Not logged in");
      const kp = deriveKeyPairFromMnemonic(phrase);
      keystore.set(kp);
      await mnemonicStore.set(user.email, phrase.trim().toLowerCase().split(/\s+/).join(" "));
      try {
        await api("/users/me/public-key", {
          method: "PUT",
          body: { publicKey: publicKeyToB64(kp.publicKey) },
        });
      } catch {
        /* non-fatal */
      }
      setNeedsRecoveryPhrase(false);
      const me = await api<{ user: SSUser }>("/auth/me");
      setUser(me.user);
    },
    [user]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await tokenStorage.clear();
    keystore.clear();
    // Note: we deliberately KEEP the mnemonic in secure storage so re-login
    // on the same device works without re-typing the phrase.
    setUser(null);
    setNeedsRecoveryPhrase(false);
  }, []);

  const logoutOtherDevices = useCallback(async () => {
    const data = await api<{ user: SSUser; access_token: string }>(
      "/auth/logout-all-other",
      { method: "POST" }
    );
    await tokenStorage.set(data.access_token);
    setUser(data.user);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        needsRecoveryPhrase,
        login,
        registerWithPhrase,
        applyRecoveryPhrase,
        logout,
        logoutOtherDevices,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
