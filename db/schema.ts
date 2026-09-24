import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  hostToken: text("host_token").notNull(),
  guestToken: text("guest_token"),
  hostName: text("host_name").notNull(),
  guestName: text("guest_name"),
  board: text("board").notNull(),
  turn: integer("turn").notNull().default(1),
  status: text("status").notNull().default("waiting"),
  winner: integer("winner"),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
