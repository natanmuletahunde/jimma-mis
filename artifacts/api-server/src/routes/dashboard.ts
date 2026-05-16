import { Router } from "express";
import { db, propertiesTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetRecentPropertiesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res): Promise<void> => {
  const all = await db.select().from(propertiesTable);
  const total = all.length;
  const approved = all.filter((p) => p.status === "approved").length;
  const pending = all.filter((p) => p.status === "pending").length;
  const rejected = all.filter((p) => p.status === "rejected").length;
  const kebeleVerified = all.filter((p) => p.status === "kebele_verified").length;
  const residential = all.filter((p) => p.propertyType === "residential").length;
  const commercial = all.filter((p) => p.propertyType === "commercial").length;
  const government = all.filter((p) => p.propertyType === "government").length;
  const institution = all.filter((p) => p.propertyType === "institution").length;
  const mixed = all.filter((p) => p.propertyType === "mixed").length;
  const withoutGps = all.filter((p) => p.latitude == null || p.longitude == null).length;

  const kebeleMap: Record<string, number> = {};
  for (const p of all) {
    kebeleMap[p.kebele] = (kebeleMap[p.kebele] ?? 0) + 1;
  }
  const kebeleBreakdown = Object.entries(kebeleMap).map(([kebele, count]) => ({ kebele, count }));

  res.json({ total, approved, pending, rejected, kebeleVerified, residential, commercial, government, institution, mixed, withoutGps, kebeleBreakdown });
});

router.get("/dashboard/by-kebele", requireAuth, async (_req, res): Promise<void> => {
  const all = await db.select({ kebele: propertiesTable.kebele }).from(propertiesTable);
  const kebeleMap: Record<string, number> = {};
  for (const p of all) {
    kebeleMap[p.kebele] = (kebeleMap[p.kebele] ?? 0) + 1;
  }
  res.json(Object.entries(kebeleMap).map(([kebele, count]) => ({ kebele, count })));
});

router.get("/dashboard/recent", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetRecentPropertiesQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;
  const rows = await db
    .select()
    .from(propertiesTable)
    .orderBy(sql`${propertiesTable.createdAt} DESC`)
    .limit(limit);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), createdByUser: null })));
});

export default router;
