import { pgTable, serial, text, integer, real, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { landParcelsTable } from "./land_parcels";
import { usersTable } from "./users";

export const buildingsTable = pgTable(
  "buildings",
  {
    id: serial("id").primaryKey(),
    buildingCode: text("building_code").notNull().unique(), // e.g. BLD-JMA-KB01-0042-B1
    parcelId: integer("parcel_id").references(() => landParcelsTable.id),
    buildingName: text("building_name"),
    structureType: text("structure_type").notNull().default("reinforced_concrete"), // reinforced_concrete | steel_frame | masonry_stone | wood_mud_chika | prefabricated
    foundationType: text("foundation_type"), // strip_footing | raft_mat | pad_footing | pile_foundation | stone_rubble
    roofMaterial: text("roof_material"), // corrugated_iron_sheet | concrete_slab | clay_tile | decra_tile
    constructionYear: integer("construction_year"),
    numberOfFloors: integer("number_of_floors").notNull().default(1),
    footprintAreaSqm: real("footprint_area_sqm"),
    totalFloorAreaSqm: real("total_floor_area_sqm"),
    buildingUse: text("building_use").notNull().default("residential"), // residential | commercial | mixed | institutional | industrial | governmental
    buildingCondition: text("building_condition").notNull().default("good"), // excellent | good | fair | dilapidated | under_construction
    hasBuildingPermit: boolean("has_building_permit").default(true),
    permitNumber: text("permit_number"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("active"), // active | under_construction | demolished
    createdBy: integer("created_by").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    buildingCodeIdx: index("buildings_code_idx").on(table.buildingCode),
    parcelIdIdx: index("buildings_parcel_id_idx").on(table.parcelId),
    statusIdx: index("buildings_status_idx").on(table.status),
    useIdx: index("buildings_use_idx").on(table.buildingUse),
  })
);

export const insertBuildingSchema = createInsertSchema(buildingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildingsTable.$inferSelect;
