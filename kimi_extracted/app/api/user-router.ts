import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { TRPCError } from "@trpc/server";

export const userRouter = createRouter({
  // Update current user's profile (phone)
  updateProfile: authedQuery
    .input(
      z.object({
        phone: z.string().min(5).max(32).optional(),
        name: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const updateData: Partial<typeof users.$inferInsert> = {};
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.name !== undefined) updateData.name = input.name;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      // Check if phone is already taken by another user
      if (input.phone) {
        const existing = await db.query.users.findFirst({
          where: eq(users.phone, input.phone),
        });
        if (existing && existing.id !== userId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Phone number already registered",
          });
        }
      }

      await db.update(users).set(updateData).where(eq(users.id, userId));

      return { success: true };
    }),

  // Find user by phone number
  findByPhone: authedQuery
    .input(z.object({ phone: z.string().min(5).max(32) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const currentUserId = ctx.user.id;

      const user = await db.query.users.findFirst({
        where: eq(users.phone, input.phone),
      });

      if (!user || user.id === currentUserId) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      };
    }),
});
