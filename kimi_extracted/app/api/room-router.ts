import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { rooms, roomMembers, messages } from "@db/schema";
import { TRPCError } from "@trpc/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const roomRouter = createRouter({
  // List all rooms the user is a member of
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const memberships = await db.query.roomMembers.findMany({
      where: eq(roomMembers.userId, userId),
      with: {
        room: {
          with: {
            members: {
              with: {
                user: true,
              },
            },
            messages: {
              orderBy: [desc(messages.createdAt)],
              limit: 1,
              with: {
                sender: true,
              },
            },
          },
        },
      },
      orderBy: (roomMembers, { desc }) => [desc(roomMembers.joinedAt)],
    });

    return memberships.map((m) => {
      const room = m.room;
      const displayName = room.type === "dm"
        ? room.members.find((rm) => rm.userId !== userId)?.user?.name || room.name
        : room.name;

      const lastMessage = room.messages[0]
        ? {
            ciphertext: room.messages[0].ciphertext,
            senderName: room.messages[0].sender?.name,
            createdAt: room.messages[0].createdAt,
          }
        : null;

      return {
        id: room.id,
        name: displayName,
        type: room.type,
        inviteCode: room.inviteCode,
        createdAt: room.createdAt,
        memberCount: room.members.length,
        lastMessage,
      };
    });
  }),

  // Get room details
  get: authedQuery
    .input(z.object({ roomId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Verify membership
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

      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, input.roomId),
        with: {
          members: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room not found",
        });
      }

      const displayName = room.type === "dm"
        ? room.members.find((rm) => rm.userId !== userId)?.user?.name || room.name
        : room.name;

      return {
        id: room.id,
        name: displayName,
        type: room.type,
        inviteCode: room.inviteCode,
        createdAt: room.createdAt,
        members: room.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          avatar: m.user.avatar,
          joinedAt: m.joinedAt,
        })),
      };
    }),

  // Create a group room
  create: authedQuery
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const inviteCode = generateInviteCode();

      const roomResult = await db.insert(rooms).values({
        name: input.name,
        type: "group",
        inviteCode,
        createdBy: userId,
      });

      const roomId = Number((roomResult as unknown as { insertId: bigint }).insertId);

      // Add creator as member
      await db.insert(roomMembers).values({
        roomId,
        userId,
      });

      return { success: true, roomId, inviteCode };
    }),

  // Join room via invite code
  join: authedQuery
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const room = await db.query.rooms.findFirst({
        where: and(
          eq(rooms.inviteCode, input.inviteCode),
          eq(rooms.type, "group")
        ),
      });

      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invite code",
        });
      }

      // Check if already a member
      const existing = await db.query.roomMembers.findFirst({
        where: and(
          eq(roomMembers.roomId, room.id),
          eq(roomMembers.userId, userId)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this room",
        });
      }

      await db.insert(roomMembers).values({
        roomId: room.id,
        userId,
      });

      return { success: true, roomId: room.id };
    }),
});
