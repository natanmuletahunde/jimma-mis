import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { streetsTable } from "./streets";

export const roadMaintenanceRecordsTable = pgTable("road_maintenance_records", {
  id: serial("id").primaryKey(),
  streetId: integer("street_id").notNull().references(() => streetsTable.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(), // inspection, resurfacing, pothole_patching, drainage_clearing, lighting_repair, expansion, emergency_repair
  pciScore: integer("pci_score"), // 0 - 100
  pciRating: text("pci_rating"), // good, satisfactory, fair, poor, very_poor, serious, failed
  distressTypes: text("distress_types"),
  performedDate: timestamp("performed_date", { withTimezone: true }).notNull(),
  contractor: text("contractor"),
  costEtb: real("cost_etb"),
  fundingSource: text("funding_source"), // municipal_budget, regional_grant, federal_grant, community_fund
  nextInspectionDue: timestamp("next_inspection_due", { withTimezone: true }),
  status: text("status").notNull().default("completed"), // completed, in_progress, scheduled, deferred
  inspectorName: text("inspector_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRoadMaintenanceRecordSchema = createInsertSchema(roadMaintenanceRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoadMaintenanceRecord = z.infer<typeof insertRoadMaintenanceRecordSchema>;
export type RoadMaintenanceRecord = typeof roadMaintenanceRecordsTable.$inferSelect;
