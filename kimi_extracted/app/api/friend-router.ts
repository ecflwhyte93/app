import { z } from "zod";
import { eq, and, or, ne } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { friends, rooms, roomMembers } from "@db/schema";
import { TRPCError } from "@trpc/server";

export const friendRouter = createRouter({
  // List friends (accepted) and pending requests
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const friendRows = await db.query.friends.findMany({
      where: or(
        and(eq(friends.requesterId, userId), ne(friends.status, "declined")),
        and(eq(friends.addresseeId, userId), ne(friends.status, "declined"))
      ),
      with: {
        requester: true,
        addressee: true,
      },
      orderBy: (friends, { desc }) => [desc(friends.updatedAt)],
    });

    return friendRows.map((f) => {
      const isRequester = f.requesterId === userId;
      const otherUser = isRequester ? f.addressee : f.requester;
      return {
        id: f.id,
        status: f.status,
        isRequester,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          email: otherUser.email,
          avatar: otherUser.avatar,
        },
        createdAt: f.createdAt,
      };
    });
  }),

  // Search users by name/email/phone to add as friend
  search: authedQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Get all existing friend relationships
      const existingFriends = await db.query.friends.findMany({
        where: or(
          eq(friends.requesterId, userId),
          eq(friends.addresseeId, userId)
        ),
      });

      const excludeIds = new Set(existingFriends.map((f) =>
        f.requesterId === userId ? f.addresseeId : f.requesterId
      ));
      excludeIds.add(userId);

      // Search users
      const allUsers = await db.query.users.findMany({
        limit: 20,
      });

      const query = input.query.toLowerCase().replace(/\s/g, '');
      const filtered = allUsers.filter((u) => {
        if (excludeIds.has(u.id)) return false;
        const nameMatch = u.name?.toLowerCase().includes(query);
        const emailMatch = u.email?.toLowerCase().includes(query);
        const phoneMatch = u.phone?.toLowerCase().replace(/\s/g, '').includes(query);
        return nameMatch || emailMatch || phoneMatch;
      }).slice(0, 10);

      return filtered.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar,
      }));
    }),

  // Send friend request
  request: authedQuery
    .input(z.object({ addresseeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const requesterId = ctx.user.id;

      if (requesterId === input.addresseeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot send friend request to yourself",
        });
      }

      // Check if already exists
      const existing = await db.query.friends.findFirst({
        where: or(
          and(
            eq(friends.requesterId, requesterId),
            eq(friends.addresseeId, input.addresseeId)
          ),
          and(
            eq(friends.requesterId, input.addresseeId),
            eq(friends.addresseeId, requesterId)
          )
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Friend request already exists",
        });
      }

      const result = await db.insert(friends).values({
        requesterId,
        addresseeId: input.addresseeId,
        status: "pending",
      });

      const insertId = (result as unknown as { insertId: bigint }).insertId;
      return { success: true, friendId: Number(insertId) };
    }),

  // Accept friend request
  accept: authedQuery
    .input(z.object({ friendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const friendRow = await db.query.friends.findFirst({
        where: eq(friends.id, input.friendId),
      });

      if (!friendRow || friendRow.addresseeId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Friend request not found",
        });
      }

      // Update status
      await db.update(friends)
        .set({ status: "accepted" })
        .where(eq(friends.id, input.friendId));

      // Create DM room
      const otherUserId = friendRow.requesterId;
      const [user1, user2] = [userId, otherUserId].sort((a, b) => a - b);
      const roomName = `DM:${user1}:${user2}`;

      const existingRoom = await db.query.rooms.findFirst({
        where: and(
          eq(rooms.name, roomName),
          eq(rooms.type, "dm")
        ),
      });

      if (!existingRoom) {
        const roomResult = await db.insert(rooms).values({
          name: roomName,
          type: "dm",
          createdBy: userId,
        });
        const roomId = Number((roomResult as unknown as { insertId: bigint }).insertId);

        // Add both users as members
        await db.insert(roomMembers).values([
          { roomId, userId },
          { roomId, userId: otherUserId },
        ]);

        return { success: true, roomId };
      }

      return { success: true, roomId: existingRoom.id };
    }),

  // Decline friend request
  decline: authedQuery
    .input(z.object({ friendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const friendRow = await db.query.friends.findFirst({
        where: eq(friends.id, input.friendId),
      });

      if (!friendRow || friendRow.addresseeId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Friend request not found",
        });
      }

      await db.update(friends)
        .set({ status: "declined" })
        .where(eq(friends.id, input.friendId));

      return { success: true };
    }),
});
