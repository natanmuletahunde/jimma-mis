import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { kebelesTable } from "./kebeles";

export const streetsTable = pgTable("streets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  kebeleId: integer("kebele_id").notNull().references(() => kebelesTable.id),
});

export const insertStreetSchema = createInsertSchema(streetsTable).omit({ id: true });
export type InsertStreet = z.infer<typeof insertStreetSchema>;
export type Street = typeof streetsTable.$inferSelect;
