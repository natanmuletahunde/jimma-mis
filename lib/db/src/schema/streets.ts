import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
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
  lengthMeters: real("length_meters"),
  widthMeters: real("width_meters"),
  condition: text("condition").notNull().default("good"),
  startIntersection: text("start_intersection"),
  endIntersection: text("end_intersection"),
  lanes: integer("lanes").default(2),
  hasSidewalk: boolean("has_sidewalk").default(false),
  hasStreetLights: boolean("has_street_lights").default(false),
  hasDrainage: boolean("has_drainage").default(false),
  lastResurfacedYear: integer("last_resurfaced_year"),
  lastPciScore: integer("last_pci_score"),
  lastPciRating: text("last_pci_rating"),
  nextInspectionDate: timestamp("next_inspection_date", { withTimezone: true }),
  maintenancePriority: text("maintenance_priority").notNull().default("routine"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStreetSchema = createInsertSchema(streetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStreet = z.infer<typeof insertStreetSchema>;
export type Street = typeof streetsTable.$inferSelect;
