import { relations } from "drizzle-orm";
import { users, friends, rooms, roomMembers, messages } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  sentFriendRequests: many(friends, { relationName: "requester" }),
  receivedFriendRequests: many(friends, { relationName: "addressee" }),
  roomMemberships: many(roomMembers),
  sentMessages: many(messages),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  requester: one(users, {
    fields: [friends.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  addressee: one(users, {
    fields: [friends.addresseeId],
    references: [users.id],
    relationName: "addressee",
  }),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  members: many(roomMembers),
  messages: many(messages),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));
