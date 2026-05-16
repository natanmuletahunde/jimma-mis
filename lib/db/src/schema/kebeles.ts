import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kebelesTable = pgTable("kebeles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  district: text("district"),
});

export const insertKebeleSchema = createInsertSchema(kebelesTable).omit({ id: true });
export type InsertKebele = z.infer<typeof insertKebeleSchema>;
export type Kebele = typeof kebelesTable.$inferSelect;
