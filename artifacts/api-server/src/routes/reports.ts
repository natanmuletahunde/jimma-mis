import { Router } from "express";
import { db, propertiesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { GetPropertyReportQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/reports/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetPropertyReportQueryParams.safeParse(req.query);
  const conditions = [];
  if (parsed.success) {
    if (parsed.data.kebele) conditions.push(eq(propertiesTable.kebele, parsed.data.kebele));
    if (parsed.data.status) conditions.push(eq(propertiesTable.status, parsed.data.status));
    if (parsed.data.property_type) conditions.push(eq(propertiesTable.propertyType, parsed.data.property_type));
    if (parsed.data.from_date) conditions.push(gte(propertiesTable.createdAt, new Date(parsed.data.from_date)));
    if (parsed.data.to_date) conditions.push(lte(propertiesTable.createdAt, new Date(parsed.data.to_date)));
  }

  const rows = await db
    .select({
      property: propertiesTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${propertiesTable.createdAt} DESC`);

  const properties = rows.map((r) => ({
    ...r.property,
    createdAt: r.property.createdAt.toISOString(),
    updatedAt: r.property.updatedAt.toISOString(),
    createdByUser: r.user?.id ? r.user : null,
  }));

  const all = properties;
  const summary = {
    total: all.length,
    approved: all.filter((p) => p.status === "approved").length,
    pending: all.filter((p) => p.status === "pending").length,
    rejected: all.filter((p) => p.status === "rejected").length,
    kebeleVerified: all.filter((p) => p.status === "kebele_verified").length,
    residential: all.filter((p) => p.propertyType === "residential").length,
    commercial: all.filter((p) => p.propertyType === "commercial").length,
    government: all.filter((p) => p.propertyType === "government").length,
    institution: all.filter((p) => p.propertyType === "institution").length,
    mixed: all.filter((p) => p.propertyType === "mixed").length,
    withoutGps: all.filter((p) => p.latitude == null || p.longitude == null).length,
    kebeleBreakdown: [],
  };

  res.json({ properties, generatedAt: new Date().toISOString(), summary });
});

export default router;
