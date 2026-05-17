import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const approvalsTable = pgTable(
  "approvals",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    action: text("action").notNull(), // approved | rejected | kebele_verified | resubmitted
    actorId: integer("actor_id").references(() => usersTable.id),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Every approval history fetch is by property_id
    propertyIdIdx: index("approvals_property_id_idx").on(table.propertyId),
  }),
);

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({ id: true, createdAt: true });
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
