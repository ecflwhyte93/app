import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStorage } from "../lib/api";

export type SSUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
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

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: SSUser; access_token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await tokenStorage.set(data.access_token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const data = await api<{ user: SSUser; access_token: string }>("/auth/register", {
        method: "POST",
        body: { email, password, name },
        auth: false,
      });
      await tokenStorage.set(data.access_token);
      setUser(data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await tokenStorage.clear();
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
