import { tokenStorage } from "./api";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

function wsUrl(path: string): string {
  // Convert http(s) -> ws(s)
  if (BASE.startsWith("https://")) return "wss://" + BASE.slice("https://".length) + path;
  if (BASE.startsWith("http://")) return "ws://" + BASE.slice("http://".length) + path;
  return BASE + path;
}

export type WSEvent =
  | { type: "hello"; userId: string }
  | { type: "message"; data: any }
  | { type: "pong" };

export type WSConnection = {
  close: () => void;
};

export async function openWS(onEvent: (ev: WSEvent) => void): Promise<WSConnection | null> {
  const token = await tokenStorage.get();
  if (!token) return null;
  let ws: WebSocket | null = null;
  let alive = true;
  let pingTimer: any = null;

  const url = wsUrl(`/api/ws?token=${encodeURIComponent(token)}`);
  try {
    ws = new WebSocket(url);
  } catch {
    return null;
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch {
      /* ignore non-JSON */
    }
  };
  ws.onopen = () => {
    pingTimer = setInterval(() => {
      try {
        ws?.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* noop */
      }
    }, 25000);
  };
  ws.onclose = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  };
  ws.onerror = () => {
    /* let onclose handle cleanup */
  };

  return {
    close() {
      alive = false;
      if (pingTimer) clearInterval(pingTimer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      void alive;
    },
  };
}
