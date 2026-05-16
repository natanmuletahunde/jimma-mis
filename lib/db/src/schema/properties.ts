import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  addressCode: text("address_code"),
  houseNumber: text("house_number"),
  buildingName: text("building_name"),
  propertyType: text("property_type").notNull().default("residential"),
  ownershipType: text("ownership_type"),
  ownerName: text("owner_name").notNull(),
  ownerPhone: text("owner_phone"),
  occupantName: text("occupant_name"),
  occupantPhone: text("occupant_phone"),
  businessName: text("business_name"),
  businessLicenseNumber: text("business_license_number"),
  numberOfFloors: integer("number_of_floors"),
  buildingUse: text("building_use"),
  kebele: text("kebele").notNull(),
  streetName: text("street_name").notNull(),
  blockCode: text("block_code"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  propertyPhoto: text("property_photo"),
  status: text("status").notNull().default("pending"),
  remark: text("remark"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
