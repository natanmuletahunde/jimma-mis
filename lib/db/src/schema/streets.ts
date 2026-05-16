import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { kebelesTable } from "./kebeles";

export const streetsTable = pgTable("streets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  kebeleId: integer("kebele_id").notNull().references(() => kebelesTable.id),
  streetType: text("street_type"),
  roadSurface: text("road_surface"),
  startLat: real("start_lat"),
  startLng: real("start_lng"),
  endLat: real("end_lat"),
  endLng: real("end_lng"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStreetSchema = createInsertSchema(streetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStreet = z.infer<typeof insertStreetSchema>;
export type Street = typeof streetsTable.$inferSelect;
