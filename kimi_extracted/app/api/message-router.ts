import { z } from "zod";
import { eq, and, desc, isNotNull, lt } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { messages, roomMembers } from "@db/schema";
import { TRPCError } from "@trpc/server";

export const messageRouter = createRouter({
  // Get messages for a room
  list: authedQuery
    .input(z.object({ roomId: z.number(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Verify user is room member
      const membership = await db.query.roomMembers.findFirst({
        where: and(
          eq(roomMembers.roomId, input.roomId),
          eq(roomMembers.userId, userId)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this room",
        });
      }

      // Delete expired ephemeral messages first
      await db.delete(messages)
        .where(
          and(
            eq(messages.roomId, input.roomId),
            isNotNull(messages.expiresAt),
            lt(messages.expiresAt, new Date())
          )
        );

      const messageRows = await db.query.messages.findMany({
        where: eq(messages.roomId, input.roomId),
        with: {
          sender: true,
        },
        orderBy: [desc(messages.createdAt)],
        limit: input.limit,
      });

      return messageRows.reverse().map((m) => ({
        id: m.id,
        roomId: m.roomId,
        senderId: m.senderId,
        senderName: m.sender?.name,
        senderAvatar: m.sender?.avatar,
        ciphertext: m.ciphertext,
        iv: m.iv,
        salt: m.salt,
        ephemeral: m.ephemeral,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
      }));
    }),

  // Send a message
  send: authedQuery
    .input(z.object({
      roomId: z.number(),
      ciphertext: z.string(),
      iv: z.string(),
      salt: z.string(),
      ephemeral: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Verify user is room member
      const membership = await db.query.roomMembers.findFirst({
        where: and(
          eq(roomMembers.roomId, input.roomId),
          eq(roomMembers.userId, userId)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this room",
        });
      }

      // Calculate expiration for ephemeral messages
      let expiresAt = null;
      if (input.ephemeral) {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }

      const result = await db.insert(messages).values({
        roomId: input.roomId,
        senderId: userId,
        ciphertext: input.ciphertext,
        iv: input.iv,
        salt: input.salt,
        ephemeral: input.ephemeral,
        expiresAt,
      });

      const insertId = (result as unknown as { insertId: bigint }).insertId;
      return { success: true, messageId: Number(insertId) };
    }),
});
