import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Friend relationships
export const friends = mysqlTable("friends", {
  id: serial("id").primaryKey(),
  requesterId: bigint("requesterId", { mode: "number", unsigned: true }).notNull(),
  addresseeId: bigint("addresseeId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "declined"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Friend = typeof friends.$inferSelect;

// Chat rooms (DM and group)
export const rooms = mysqlTable("rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["dm", "group"]).notNull(),
  inviteCode: varchar("inviteCode", { length: 64 }),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;

// Room memberships
export const roomMembers = mysqlTable("room_members", {
  id: serial("id").primaryKey(),
  roomId: bigint("roomId", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type RoomMember = typeof roomMembers.$inferSelect;

// Encrypted messages
export const messages = mysqlTable("messages", {
  id: serial("id").primaryKey(),
  roomId: bigint("roomId", { mode: "number", unsigned: true }).notNull(),
  senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  ephemeral: boolean("ephemeral").default(false).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
