import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStorage } from "../lib/api";
import { deriveKeyPair, publicKeyToB64 } from "../lib/encryption";
import { keystore } from "../lib/keystore";

export type SSUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  publicKey: string | null;
  role: string;
};

type AuthState = {
  user: SSUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

const PASSWORD_CACHE_KEY = "silent_signal_pw_cache";

// We keep a tiny in-memory cache of the user's password between mount/unmount
// of the app session so that resuming the session (token still valid) can
// re-derive the keypair without prompting. This lives only in-memory — never
// persisted to disk.
const sessionPwCache: { email: string | null; password: string | null } = {
  email: null,
  password: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SSUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await tokenStorage.get();
      if (!token) {
        setUser(null);
        return;
      }
      const data = await api<{ user: SSUser }>("/auth/me");
      setUser(data.user);
      // If we have a cached password from this session, restore the keypair
      if (
        sessionPwCache.email &&
        sessionPwCache.password &&
        sessionPwCache.email === data.user.email
      ) {
        const kp = deriveKeyPair(sessionPwCache.email, sessionPwCache.password);
        keystore.set(kp);
      }
    } catch {
      setUser(null);
      await tokenStorage.clear();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const ensureKeypair = useCallback(async (email: string, password: string) => {
    const kp = deriveKeyPair(email, password);
    keystore.set(kp);
    sessionPwCache.email = email;
    sessionPwCache.password = password;
    // Make sure the server has our pubkey (idempotent)
    try {
      await api("/users/me/public-key", {
        method: "PUT",
        body: { publicKey: publicKeyToB64(kp.publicKey) },
      });
    } catch {
      /* non-fatal */
    }
    void PASSWORD_CACHE_KEY;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ user: SSUser; access_token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      await tokenStorage.set(data.access_token);
      await ensureKeypair(email.toLowerCase(), password);
      // Fetch user again so publicKey field reflects the upload
      try {
        const me = await api<{ user: SSUser }>("/auth/me");
        setUser(me.user);
      } catch {
        setUser(data.user);
      }
    },
    [ensureKeypair]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const data = await api<{ user: SSUser; access_token: string }>("/auth/register", {
        method: "POST",
        body: { email, password, name },
        auth: false,
      });
      await tokenStorage.set(data.access_token);
      await ensureKeypair(email.toLowerCase(), password);
      try {
        const me = await api<{ user: SSUser }>("/auth/me");
        setUser(me.user);
      } catch {
        setUser(data.user);
      }
    },
    [ensureKeypair]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await tokenStorage.clear();
    keystore.clear();
    sessionPwCache.email = null;
    sessionPwCache.password = null;
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
