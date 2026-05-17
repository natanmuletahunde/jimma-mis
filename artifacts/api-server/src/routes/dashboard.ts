import { Router } from "express";
import { db, propertiesTable, usersTable, kebelesTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── Shared: build WHERE conditions from query params + role ──────────────────
// Returns an array of Drizzle conditions; caller uses and(...) or undefined.

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

  // Scope by role — enumerators see only their own; kebele officers see only their kebele
  if (user.role === "enumerator") {
    conditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer" && user.kebeleId) {
    const [rec] = await db
      .select({ name: kebelesTable.name })
      .from(kebelesTable)
      .where(eq(kebelesTable.id, user.kebeleId))
      .limit(1);
    if (rec?.name) {
      conditions.push(ilike(propertiesTable.kebele, rec.name) as ReturnType<typeof eq>);
    }
  }

  return conditions;
}

// ─── GET /dashboard/stats ─────────────────────────────────────────────────────
// Uses a single SQL aggregation query (COUNT with FILTER) instead of loading
// all rows into memory and counting in JavaScript.

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const conditions = await buildConditions(req.query as Record<string, unknown>, req.user!);
  const where = conditions.length ? and(...conditions) : undefined;

  // Single-pass aggregation: all counters in one round-trip
  const [counts] = await db
    .select({
      total:          sql<number>`count(*)::int`,
      draft:          sql<number>`count(*) filter (where ${propertiesTable.status} = 'draft')::int`,
      approved:       sql<number>`count(*) filter (where ${propertiesTable.status} = 'approved')::int`,
      pending:        sql<number>`count(*) filter (where ${propertiesTable.status} = 'pending')::int`,
      rejected:       sql<number>`count(*) filter (where ${propertiesTable.status} = 'rejected')::int`,
      kebeleVerified: sql<number>`count(*) filter (where ${propertiesTable.status} = 'kebele_verified')::int`,
      residential:    sql<number>`count(*) filter (where ${propertiesTable.propertyType} = 'residential')::int`,
      commercial:     sql<number>`count(*) filter (where ${propertiesTable.propertyType} = 'commercial')::int`,
      government:     sql<number>`count(*) filter (where ${propertiesTable.propertyType} = 'government')::int`,
      institution:    sql<number>`count(*) filter (where ${propertiesTable.propertyType} = 'institution')::int`,
      // Schema and spec both use "mixed" — not "mixed_use"
      mixed:          sql<number>`count(*) filter (where ${propertiesTable.propertyType} = 'mixed')::int`,
      withoutGps:     sql<number>`count(*) filter (where ${propertiesTable.latitude} is null or ${propertiesTable.longitude} is null)::int`,
    })
    .from(propertiesTable)
    .where(where);

  // Kebele breakdown in a second aggregation query (GROUP BY)
  const kebeleBreakdown = await db
    .select({
      kebele: propertiesTable.kebele,
      count:  sql<number>`count(*)::int`,
    })
    .from(propertiesTable)
    .where(where)
    .groupBy(propertiesTable.kebele)
    .orderBy(sql`count(*) desc`);

  res.json({ ...counts, kebeleBreakdown });
});

// ─── GET /dashboard/by-kebele ─────────────────────────────────────────────────
// Aggregation query — no full table scan.

router.get("/dashboard/by-kebele", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      kebele: propertiesTable.kebele,
      count:  sql<number>`count(*)::int`,
    })
    .from(propertiesTable)
    .groupBy(propertiesTable.kebele)
    .orderBy(sql`count(*) desc`);

  res.json(rows);
});

// ─── GET /dashboard/recent ────────────────────────────────────────────────────

router.get("/dashboard/recent", requireAuth, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const conditions = await buildConditions(req.query as Record<string, unknown>, req.user!);

  const rows = await db
    .select({
      property: propertiesTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(propertiesTable.createdAt))
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
// 30-day daily registration count with zero-fill for missing days.

router.get("/dashboard/trend", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const roleConditions: ReturnType<typeof eq>[] = [];

  if (user.role === "enumerator") {
    roleConditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer" && user.kebeleId) {
    const [rec] = await db
      .select({ name: kebelesTable.name })
      .from(kebelesTable)
      .where(eq(kebelesTable.id, user.kebeleId))
      .limit(1);
    if (rec?.name) {
      roleConditions.push(ilike(propertiesTable.kebele, rec.name) as ReturnType<typeof eq>);
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allConditions = [
    gte(propertiesTable.createdAt, thirtyDaysAgo) as ReturnType<typeof eq>,
    ...roleConditions,
  ];

  const rows = await db
    .select({
      date:  sql<string>`to_char(date_trunc('day', ${propertiesTable.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(propertiesTable)
    .where(and(...allConditions))
    .groupBy(sql`date_trunc('day', ${propertiesTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${propertiesTable.createdAt})`);

  // Fill in zeros for days with no registrations
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
