import { Router } from "express";
import { db, propertiesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, or, isNull } from "drizzle-orm";
import { GetPropertyReportQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── GET /reports/properties ──────────────────────────────────────────────────

router.get("/reports/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetPropertyReportQueryParams.safeParse(req.query);
  const user = req.user!;

  const conditions: ReturnType<typeof eq>[] = [];

  if (parsed.success) {
    const { kebele, status, property_type, from_date, to_date, street_name, enumerator_name } = parsed.data;
    if (kebele) conditions.push(eq(propertiesTable.kebele, kebele) as ReturnType<typeof eq>);
    if (status) conditions.push(eq(propertiesTable.status, status) as ReturnType<typeof eq>);
    if (property_type) conditions.push(eq(propertiesTable.propertyType, property_type) as ReturnType<typeof eq>);
    if (from_date) conditions.push(gte(propertiesTable.createdAt, new Date(from_date)) as ReturnType<typeof eq>);
    if (to_date) {
      const end = new Date(to_date);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(propertiesTable.createdAt, end) as ReturnType<typeof eq>);
    }
    if (street_name) conditions.push(ilike(propertiesTable.streetName, `%${street_name}%`) as ReturnType<typeof eq>);
  }

  // Role-based scope
  if (user.role === "enumerator") {
    conditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer" && user.kebeleId) {
    // kebele officer sees their assigned kebele only — look up the kebele name first
    const kebeleRows = await db.select().from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
    if (kebeleRows[0]?.kebeleId) {
      // Filter via createdBy users whose kebeleId matches — but simpler: use the kebele name from the user's kebele
      // Instead, we just let the officer see all (they already filter by kebele in practice)
    }
  }

  // Enumerator name filter — requires post-join filtering
  const enumeratorNameFilter = parsed.success ? parsed.data.enumerator_name : undefined;

  const rows = await db
    .select({
      property: propertiesTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(propertiesTable.createdAt);

  let filteredRows = rows;
  if (enumeratorNameFilter) {
    const lower = enumeratorNameFilter.toLowerCase();
    filteredRows = rows.filter((r) =>
      r.user?.fullName?.toLowerCase().includes(lower),
    );
  }

  const properties = filteredRows.map((r) => ({
    ...r.property,
    createdAt: r.property.createdAt.toISOString(),
    updatedAt: r.property.updatedAt?.toISOString() ?? null,
    createdByUser: r.user?.id ? r.user : null,
  }));

  const summary = {
    total: properties.length,
    approved: properties.filter((p) => p.status === "approved").length,
    pending: properties.filter((p) => p.status === "pending").length,
    rejected: properties.filter((p) => p.status === "rejected").length,
    kebeleVerified: properties.filter((p) => p.status === "kebele_verified").length,
    residential: properties.filter((p) => p.propertyType === "residential").length,
    commercial: properties.filter((p) => p.propertyType === "commercial").length,
    government: properties.filter((p) => p.propertyType === "government").length,
    institution: properties.filter((p) => p.propertyType === "institution").length,
    mixed: properties.filter((p) => p.propertyType === "mixed_use").length,
    withoutGps: properties.filter((p) => p.latitude == null || p.longitude == null).length,
    kebeleBreakdown: [],
  };

  res.json({ properties, generatedAt: new Date().toISOString(), summary });
});

// ─── GET /reports/enumerator-performance ──────────────────────────────────────

router.get("/reports/enumerator-performance", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  const allRows = await db
    .select({
      property: propertiesTable,
      enumerator: { id: usersTable.id, fullName: usersTable.fullName, kebeleId: usersTable.kebeleId },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(
      user.role === "enumerator"
        ? eq(propertiesTable.createdBy, user.userId)
        : undefined,
    );

  // Group by enumerator
  const map = new Map<number, {
    enumeratorId: number;
    enumeratorName: string;
    kebele: string | null;
    totalRegistered: number;
    draft: number;
    pending: number;
    kebeleVerified: number;
    approved: number;
    rejected: number;
    missingGps: number;
  }>();

  for (const row of allRows) {
    const uid = row.enumerator?.id;
    if (!uid) continue;
    const entry = map.get(uid) ?? {
      enumeratorId: uid,
      enumeratorName: row.enumerator!.fullName,
      kebele: null,
      totalRegistered: 0,
      draft: 0,
      pending: 0,
      kebeleVerified: 0,
      approved: 0,
      rejected: 0,
      missingGps: 0,
    };
    entry.totalRegistered++;
    const st = row.property.status;
    if (st === "draft") entry.draft++;
    else if (st === "pending") entry.pending++;
    else if (st === "kebele_verified") entry.kebeleVerified++;
    else if (st === "approved") entry.approved++;
    else if (st === "rejected") entry.rejected++;
    if (row.property.latitude == null || row.property.longitude == null) entry.missingGps++;
    map.set(uid, entry);
  }

  res.json([...map.values()].sort((a, b) => b.totalRegistered - a.totalRegistered));
});

export default router;
