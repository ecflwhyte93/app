import { authRouter } from "./auth-router";
import { friendRouter } from "./friend-router";
import { roomRouter } from "./room-router";
import { messageRouter } from "./message-router";
import { userRouter } from "./user-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  friend: friendRouter,
  room: roomRouter,
  message: messageRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
