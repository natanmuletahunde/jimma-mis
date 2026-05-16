import { Router } from "express";
import { db, propertiesTable, approvalsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, or, sql, isNull, ne } from "drizzle-orm";
import {
  ListPropertiesQueryParams,
  CreatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
  UpdatePropertyBody,
  DeletePropertyParams,
  ApprovePropertyParams,
  ApprovePropertyBody,
  RejectPropertyParams,
  RejectPropertyBody,
  ResubmitPropertyParams,
  CheckDuplicateQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

function generateAddressCode(kebele: string, streetName: string, blockCode: string | null | undefined, houseNumber: string | null | undefined): string {
  const kb = kebele.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  const st = streetName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  const bl = (blockCode ?? "000").replace(/[^A-Z0-9]/g, "");
  const hn = (houseNumber ?? "000").replace(/[^A-Z0-9]/g, "");
  return `JIM-KB${kb}-ST${st}-BL${bl}-HN${hn}`;
}

async function fetchPropertyWithUser(id: number) {
  const [prop] = await db
    .select({
      property: propertiesTable,
      user: {
        id: usersTable.id,
        fullName: usersTable.fullName,
        role: usersTable.role,
      },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(eq(propertiesTable.id, id));
  if (!prop) return null;
  return {
    ...prop.property,
    createdAt: prop.property.createdAt.toISOString(),
    updatedAt: prop.property.updatedAt.toISOString(),
    createdByUser: prop.user?.id ? prop.user : null,
  };
}

router.get("/properties/check-duplicate", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckDuplicateQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { latitude, longitude, house_number, street_name, block_code, exclude_id } = parsed.data;
  let hasDuplicateGps = false;
  let nearbyProperties: unknown[] = [];

  if (latitude != null && longitude != null) {
    const conditions = [];
    if (exclude_id) conditions.push(ne(propertiesTable.id, exclude_id));
    const gpsProps = await db
      .select()
      .from(propertiesTable)
      .where(conditions.length ? and(...conditions) : undefined);
    const nearby = gpsProps.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      const dist = Math.sqrt(Math.pow((p.latitude - latitude) * 111000, 2) + Math.pow((p.longitude - longitude) * 111000 * Math.cos(latitude * Math.PI / 180), 2));
      return dist < 10;
    });
    hasDuplicateGps = nearby.length > 0;
    nearbyProperties = nearby.map((p) => ({
      id: p.id, addressCode: p.addressCode, propertyType: p.propertyType, status: p.status,
      latitude: p.latitude, longitude: p.longitude, ownerName: p.ownerName,
      buildingName: p.buildingName, kebele: p.kebele, streetName: p.streetName, houseNumber: p.houseNumber,
    }));
  }

  let hasDuplicateHouseNumber = false;
  if (house_number && street_name) {
    const conditions = [eq(propertiesTable.streetName, street_name), eq(propertiesTable.houseNumber, house_number)];
    if (block_code) conditions.push(eq(propertiesTable.blockCode, block_code));
    if (exclude_id) conditions.push(ne(propertiesTable.id, exclude_id));
    const [dup] = await db.select().from(propertiesTable).where(and(...conditions));
    hasDuplicateHouseNumber = !!dup;
  }

  res.json({ hasDuplicateGps, hasDuplicateHouseNumber, nearbyProperties });
});

router.get("/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPropertiesQueryParams.safeParse(req.query);
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (parsed.success) {
    if (parsed.data.kebele) conditions.push(eq(propertiesTable.kebele, parsed.data.kebele));
    if (parsed.data.status) conditions.push(eq(propertiesTable.status, parsed.data.status));
    if (parsed.data.property_type) conditions.push(eq(propertiesTable.propertyType, parsed.data.property_type));
    if (parsed.data.search) {
      conditions.push(
        or(
          ilike(propertiesTable.ownerName, `%${parsed.data.search}%`),
          ilike(propertiesTable.buildingName, `%${parsed.data.search}%`),
          ilike(propertiesTable.addressCode, `%${parsed.data.search}%`),
          ilike(propertiesTable.houseNumber, `%${parsed.data.search}%`)
        )
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertiesTable)
    .where(whereClause);

  const rows = await db
    .select({
      property: propertiesTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${propertiesTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const properties = rows.map((r) => ({
    ...r.property,
    createdAt: r.property.createdAt.toISOString(),
    updatedAt: r.property.updatedAt.toISOString(),
    createdByUser: r.user?.id ? r.user : null,
  }));

  res.json({ properties, total: count, page, limit });
});

router.post("/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prop] = await db
    .insert(propertiesTable)
    .values({ ...parsed.data, createdBy: req.user!.userId, status: "pending" })
    .returning();
  res.status(201).json({ ...prop, createdAt: prop.createdAt.toISOString(), updatedAt: prop.updatedAt.toISOString(), createdByUser: null });
});

router.get("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const prop = await fetchPropertyWithUser(params.data.id);
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(prop);
});

router.patch("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prop] = await db.update(propertiesTable).set(parsed.data).where(eq(propertiesTable.id, params.data.id)).returning();
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json({ ...prop, createdAt: prop.createdAt.toISOString(), updatedAt: prop.updatedAt.toISOString(), createdByUser: null });
});

router.delete("/properties/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/properties/:id/approve", requireAuth, requireRole("admin", "city_officer", "kebele_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ApprovePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bodyParsed = ApprovePropertyBody.safeParse(req.body);
  const remark = bodyParsed.success ? bodyParsed.data.remark : undefined;

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const userRole = req.user!.role;
  let newStatus = existing.status;
  let action = "approved";

  if (userRole === "kebele_officer" && existing.status === "pending") {
    newStatus = "kebele_verified";
    action = "kebele_verified";
  } else if ((userRole === "city_officer" || userRole === "admin") && (existing.status === "pending" || existing.status === "kebele_verified")) {
    newStatus = "approved";
    action = "approved";
  } else {
    res.status(400).json({ error: "Cannot approve from current status with your role" });
    return;
  }

  const addressCode = generateAddressCode(existing.kebele, existing.streetName, existing.blockCode, existing.houseNumber);

  const [updated] = await db
    .update(propertiesTable)
    .set({ status: newStatus, addressCode: newStatus === "approved" ? addressCode : existing.addressCode, remark })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  await db.insert(approvalsTable).values({ propertyId: params.data.id, action, actorId: req.user!.userId, remark });

  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(), createdByUser: null });
});

router.post("/properties/:id/reject", requireAuth, requireRole("admin", "city_officer", "kebele_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RejectPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RejectPropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(propertiesTable)
    .set({ status: "rejected", remark: parsed.data.remark })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  await db.insert(approvalsTable).values({ propertyId: params.data.id, action: "rejected", actorId: req.user!.userId, remark: parsed.data.remark });
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(), createdByUser: null });
});

router.post("/properties/:id/resubmit", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ResubmitPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(propertiesTable)
    .set({ status: "pending" })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  await db.insert(approvalsTable).values({ propertyId: params.data.id, action: "resubmitted", actorId: req.user!.userId });
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(), createdByUser: null });
});

export default router;
