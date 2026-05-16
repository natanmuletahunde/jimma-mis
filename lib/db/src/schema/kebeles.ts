import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kebelesTable = pgTable("kebeles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  city: text("city").notNull().default("Jimma"),
  subCity: text("sub_city"),
  woreda: text("woreda"),
  district: text("district"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKebeleSchema = createInsertSchema(kebelesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKebele = z.infer<typeof insertKebeleSchema>;
export type Kebele = typeof kebelesTable.$inferSelect;
