import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const PHOTO_CATEGORIES = ["front_view", "side_view", "business_sign", "document", "other"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  front_view: "Front View",
  side_view: "Side View",
  business_sign: "Business Sign",
  document: "Document / Evidence",
  other: "Other",
};

export const propertyPhotosTable = pgTable(
  "property_photos",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    photoUrl: text("photo_url").notNull(),
    fileName: text("file_name"),
    fileType: text("file_type"),
    photoCategory: text("photo_category").notNull().default("other"),
    uploadedBy: integer("uploaded_by").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Essential: every photo lookup is by property_id
    propertyIdIdx: index("property_photos_property_id_idx").on(table.propertyId),
  }),
);

export const insertPropertyPhotoSchema = createInsertSchema(propertyPhotosTable).omit({ id: true, createdAt: true });
export type InsertPropertyPhoto = z.infer<typeof insertPropertyPhotoSchema>;
export type PropertyPhoto = typeof propertyPhotosTable.$inferSelect;
