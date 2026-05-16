import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const propertyPhotosTable = pgTable("property_photos", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPropertyPhotoSchema = createInsertSchema(propertyPhotosTable).omit({ id: true, createdAt: true });
export type InsertPropertyPhoto = z.infer<typeof insertPropertyPhotoSchema>;
export type PropertyPhoto = typeof propertyPhotosTable.$inferSelect;
