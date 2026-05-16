import { Router } from "express";
import { db, propertiesTable, usersTable, kebelesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── Shared: build filter conditions from query + role ─────────────────────────

async function buildConditions(
  query: Record<string, unknown>,
  user: { userId: number; role: string; kebeleId?: number | null },
) {
  const conditions: ReturnType<typeof eq>[] = [];

  const { from_date, to_date, kebele, property_type, status } = query as Record<string, string>;

  if (from_date) {
    const d = new Date(from_date);
    if (!isNaN(d.getTime())) conditions.push(gte(propertiesTable.createdAt, d) as ReturnType<typeof eq>);
  }
  if (to_date) {
    const d = new Date(to_date);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(propertiesTable.createdAt, d) as ReturnType<typeof eq>);
    }
  }
  if (kebele) conditions.push(eq(propertiesTable.kebele, kebele) as ReturnType<typeof eq>);
  if (property_type) conditions.push(eq(propertiesTable.propertyType, property_type) as ReturnType<typeof eq>);
  if (status) conditions.push(eq(propertiesTable.status, status) as ReturnType<typeof eq>);

  // Role-based scope
  if (user.role === "enumerator") {
    conditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer" && user.kebeleId) {
    const rec = await db
      .select({ name: kebelesTable.name })
      .from(kebelesTable)
      .where(eq(kebelesTable.id, user.kebeleId))
      .limit(1);
    if (rec[0]?.name) {
      conditions.push(ilike(propertiesTable.kebele, rec[0].name) as ReturnType<typeof eq>);
    }
  }

  return conditions;
}

// ─── GET /dashboard/stats ──────────────────────────────────────────────────────

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const conditions = await buildConditions(req.query as Record<string, unknown>, req.user!);

  const all = await db
    .select()
    .from(propertiesTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const total = all.length;
  const draft = all.filter((p) => p.status === "draft").length;
  const approved = all.filter((p) => p.status === "approved").length;
  const pending = all.filter((p) => p.status === "pending").length;
  const rejected = all.filter((p) => p.status === "rejected").length;
  const kebeleVerified = all.filter((p) => p.status === "kebele_verified").length;
  const residential = all.filter((p) => p.propertyType === "residential").length;
  const commercial = all.filter((p) => p.propertyType === "commercial").length;
  const government = all.filter((p) => p.propertyType === "government").length;
  const institution = all.filter((p) => p.propertyType === "institution").length;
  const mixed = all.filter((p) => p.propertyType === "mixed_use").length;
  const withoutGps = all.filter((p) => p.latitude == null || p.longitude == null).length;

  const kebeleMap: Record<string, number> = {};
  for (const p of all) {
    kebeleMap[p.kebele] = (kebeleMap[p.kebele] ?? 0) + 1;
  }
  const kebeleBreakdown = Object.entries(kebeleMap)
    .map(([kebele, count]) => ({ kebele, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ total, draft, approved, pending, rejected, kebeleVerified, residential, commercial, government, institution, mixed, withoutGps, kebeleBreakdown });
});

// ─── GET /dashboard/by-kebele ─────────────────────────────────────────────────

router.get("/dashboard/by-kebele", requireAuth, async (_req, res): Promise<void> => {
  const all = await db.select({ kebele: propertiesTable.kebele }).from(propertiesTable);
  const kebeleMap: Record<string, number> = {};
  for (const p of all) {
    kebeleMap[p.kebele] = (kebeleMap[p.kebele] ?? 0) + 1;
  }
  res.json(Object.entries(kebeleMap).map(([kebele, count]) => ({ kebele, count })));
});

// ─── GET /dashboard/recent ────────────────────────────────────────────────────

router.get("/dashboard/recent", requireAuth, async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 10;
  const conditions = await buildConditions(req.query as Record<string, unknown>, req.user!);

  const rows = await db
    .select({
      property: propertiesTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${propertiesTable.createdAt} DESC`)
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r.property,
      createdAt: r.property.createdAt.toISOString(),
      updatedAt: r.property.updatedAt?.toISOString() ?? null,
      createdByUser: r.user?.id ? r.user : null,
    })),
  );
});

// ─── GET /dashboard/trend ─────────────────────────────────────────────────────

router.get("/dashboard/trend", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const roleConditions: ReturnType<typeof eq>[] = [];

  if (user.role === "enumerator") {
    roleConditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer" && user.kebeleId) {
    const rec = await db
      .select({ name: kebelesTable.name })
      .from(kebelesTable)
      .where(eq(kebelesTable.id, user.kebeleId))
      .limit(1);
    if (rec[0]?.name) {
      roleConditions.push(ilike(propertiesTable.kebele, rec[0].name) as ReturnType<typeof eq>);
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allConditions = [
    gte(propertiesTable.createdAt, thirtyDaysAgo) as ReturnType<typeof eq>,
    ...roleConditions,
  ];

  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${propertiesTable.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(propertiesTable)
    .where(and(...allConditions))
    .groupBy(sql`date_trunc('day', ${propertiesTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${propertiesTable.createdAt})`);

  // Fill in zero days for gaps
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const trend: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    trend.push({ date: key, count: map.get(key) ?? 0 });
  }

  res.json(trend);
});

export default router;
