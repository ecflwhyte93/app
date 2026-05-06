import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const TOKEN_KEY = "silent_signal_token";

// expo-secure-store doesn't run on web -> fallback to localStorage
const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return typeof window !== "undefined"
          ? window.localStorage.getItem(TOKEN_KEY)
          : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* noop */
      }
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web") {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* noop */
      }
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export const tokenStorage = storage;

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: any) => e?.msg || JSON.stringify(e)).join(" ")
          : detail?.msg || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
