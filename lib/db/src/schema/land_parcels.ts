import { pgTable, serial, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { kebelesTable } from "./kebeles";
import { streetsTable } from "./streets";
import { usersTable } from "./users";

export const landParcelsTable = pgTable(
  "land_parcels",
  {
    id: serial("id").primaryKey(),
    parcelUpi: text("parcel_upi").notNull().unique(), // e.g. JMA-KB01-BLK03-P0042
    kebeleId: integer("kebele_id").references(() => kebelesTable.id),
    kebele: text("kebele").notNull(),
    blockCode: text("block_code"),
    streetId: integer("street_id").references(() => streetsTable.id),
    streetName: text("street_name"),
    areaSqm: real("area_sqm"),
    landTenure: text("land_tenure").notNull().default("leasehold"), // leasehold | freehold | customary | municipal_public
    titleDeedNumber: text("title_deed_number"),
    zoningClassification: text("zoning_classification").notNull().default("residential"), // residential | commercial | mixed_use | industrial | public_civic | agricultural
    centerLat: real("center_lat"),
    centerLng: real("center_lng"),
    boundaryPolygon: text("boundary_polygon"), // JSON coordinate string [[lat, lng], ...]
    status: text("status").notNull().default("registered"), // registered | under_survey | disputed | transferred
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    upiIdx: index("land_parcels_upi_idx").on(table.parcelUpi),
    kebeleIdx: index("land_parcels_kebele_idx").on(table.kebele),
    statusIdx: index("land_parcels_status_idx").on(table.status),
    zoningIdx: index("land_parcels_zoning_idx").on(table.zoningClassification),
  })
);

export const insertLandParcelSchema = createInsertSchema(landParcelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLandParcel = z.infer<typeof insertLandParcelSchema>;
export type LandParcel = typeof landParcelsTable.$inferSelect;
