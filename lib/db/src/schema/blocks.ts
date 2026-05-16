import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { kebelesTable } from "./kebeles";
import { streetsTable } from "./streets";

export const blocksTable = pgTable("blocks", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  kebeleId: integer("kebele_id").notNull().references(() => kebelesTable.id),
  streetId: integer("street_id").notNull().references(() => streetsTable.id),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocksTable.$inferSelect;
