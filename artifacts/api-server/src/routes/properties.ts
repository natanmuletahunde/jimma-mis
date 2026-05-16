import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { db, propertiesTable, approvalsTable, usersTable, propertyPhotosTable } from "@workspace/db";
import { eq, and, ilike, or, sql, ne, desc } from "drizzle-orm";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `prop-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

function generateAddressCode(
  kebele: string,
  streetName: string,
  blockCode: string | null | undefined,
  houseNumber: string | null | undefined,
): string {
  const kb = kebele.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  const st = streetName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  const bl = (blockCode ?? "000").replace(/[^A-Z0-9]/g, "");
  const hn = (houseNumber ?? "000").replace(/[^A-Z0-9]/g, "");
  return `JIM-KB${kb}-ST${st}-BL${bl}-HN${hn}`;
}

function serializeProperty(prop: typeof propertiesTable.$inferSelect, user?: { id: number; fullName: string; role: string } | null) {
  return {
    ...prop,
    createdAt: prop.createdAt.toISOString(),
    updatedAt: prop.updatedAt.toISOString(),
    createdByUser: user?.id ? user : null,
  };
}

async function fetchPropertyWithUser(id: number) {
  const [row] = await db
    .select({ property: propertiesTable, user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role } })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(eq(propertiesTable.id, id));
  if (!row) return null;
  return serializeProperty(row.property, row.user);
}

// ─── Duplicate check ──────────────────────────────────────────────────────────

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
    const excl = exclude_id ? [ne(propertiesTable.id, exclude_id)] : [];
    const gpsProps = await db.select().from(propertiesTable).where(excl.length ? and(...excl) : undefined);
    const nearby = gpsProps.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      const dist = Math.sqrt(
        Math.pow((p.latitude - latitude) * 111000, 2) +
          Math.pow((p.longitude - longitude) * 111000 * Math.cos((latitude * Math.PI) / 180), 2),
      );
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
    const conds = [eq(propertiesTable.streetName, street_name), eq(propertiesTable.houseNumber, house_number)];
    if (block_code) conds.push(eq(propertiesTable.blockCode, block_code));
    if (exclude_id) conds.push(ne(propertiesTable.id, exclude_id));
    const [dup] = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(and(...conds));
    hasDuplicateHouseNumber = !!dup;
  }

  res.json({ hasDuplicateGps, hasDuplicateHouseNumber, nearbyProperties });
});

// ─── List ─────────────────────────────────────────────────────────────────────

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
          ilike(propertiesTable.houseNumber, `%${parsed.data.search}%`),
        ),
      );
    }
  }
  // Enumerators only see their own properties
  if (req.user!.role === "enumerator") {
    conditions.push(eq(propertiesTable.createdBy, req.user!.userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(propertiesTable).where(whereClause);
  const rows = await db
    .select({ property: propertiesTable, user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role } })
    .from(propertiesTable)
    .leftJoin(usersTable, eq(propertiesTable.createdBy, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${propertiesTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    properties: rows.map((r) => serializeProperty(r.property, r.user)),
    total: count,
    page,
    limit,
  });
});

// ─── Create (saves as Draft) ──────────────────────────────────────────────────

router.post("/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Validate commercial requires business name
  if (data.propertyType === "commercial" && !data.businessName) {
    res.status(400).json({ error: "Business name is required for commercial properties" });
    return;
  }

  // Duplicate house number check at creation time
  if (data.houseNumber && data.streetName) {
    const dupConds = [
      eq(propertiesTable.streetName, data.streetName),
      eq(propertiesTable.houseNumber, data.houseNumber),
    ];
    if (data.blockCode) dupConds.push(eq(propertiesTable.blockCode, data.blockCode));
    if (data.kebele) dupConds.push(eq(propertiesTable.kebele, data.kebele));
    const [dup] = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(and(...dupConds));
    if (dup) {
      res.status(409).json({ error: "A property with this house number already exists at this location" });
      return;
    }
  }

  const addressCode = generateAddressCode(data.kebele, data.streetName, data.blockCode, data.houseNumber);

  const [prop] = await db
    .insert(propertiesTable)
    .values({ ...data, createdBy: req.user!.userId, status: "draft", addressCode })
    .returning();

  await db.insert(approvalsTable).values({ propertyId: prop.id, action: "created", actorId: req.user!.userId });
  res.status(201).json(serializeProperty(prop, null));
});

// ─── Get one ─────────────────────────────────────────────────────────────────

router.get("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const prop = await fetchPropertyWithUser(params.data.id);
  if (!prop) { res.status(404).json({ error: "Property not found" }); return; }
  res.json(prop);
});

// ─── Update ───────────────────────────────────────────────────────────────────

router.patch("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Property not found" }); return; }

  // Enumerators can only edit their own draft/rejected records
  if (req.user!.role === "enumerator") {
    if (existing.createdBy !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!["draft", "rejected"].includes(existing.status)) {
      res.status(400).json({ error: "Cannot edit a property that is already submitted" });
      return;
    }
  }

  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Regenerate provisional address code if location fields changed
  const newKebele = parsed.data.kebele ?? existing.kebele;
  const newStreet = parsed.data.streetName ?? existing.streetName;
  const newBlock = parsed.data.blockCode ?? existing.blockCode;
  const newHouse = parsed.data.houseNumber ?? existing.houseNumber;
  const addressCode = existing.status !== "approved"
    ? generateAddressCode(newKebele, newStreet, newBlock, newHouse)
    : existing.addressCode;

  const [prop] = await db
    .update(propertiesTable)
    .set({ ...parsed.data, addressCode: addressCode ?? undefined })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  res.json(serializeProperty(prop, null));
});

// ─── Delete ───────────────────────────────────────────────────────────────────

router.delete("/properties/:id", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  res.sendStatus(204);
});

// ─── Submit (Draft/Rejected → Pending) ───────────────────────────────────────

router.post("/properties/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid property id" }); return; }

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Property not found" }); return; }

  // Only the creator (enumerator) or admin can submit
  if (req.user!.role === "enumerator" && existing.createdBy !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!["draft", "rejected"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot submit a property with status '${existing.status}'` });
    return;
  }

  if (existing.latitude == null || existing.longitude == null) {
    res.status(400).json({ error: "GPS coordinates are required before submitting" });
    return;
  }

  // Accept either a legacy propertyPhoto OR a front_view entry in property_photos
  const [frontViewPhoto] = await db
    .select({ id: propertyPhotosTable.id })
    .from(propertyPhotosTable)
    .where(and(eq(propertyPhotosTable.propertyId, id), eq(propertyPhotosTable.photoCategory, "front_view")))
    .limit(1);
  if (!existing.propertyPhoto && !frontViewPhoto) {
    res.status(400).json({ error: "A front view photo is required before submitting" });
    return;
  }

  const [updated] = await db
    .update(propertiesTable)
    .set({ status: "pending" })
    .where(eq(propertiesTable.id, id))
    .returning();

  await db.insert(approvalsTable).values({ propertyId: id, action: "submitted", actorId: req.user!.userId });

  res.json(serializeProperty(updated, null));
});

// ─── Legacy single-photo upload (kept for backward compatibility) ──────────────
// New code should use POST /properties/:id/photos (photos.ts router)

router.post("/properties/:id/photo", requireAuth, upload.single("photo"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid property id" }); return; }

  if (!req.file) {
    res.status(400).json({ error: "No photo file uploaded" });
    return;
  }

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Property not found" }); return; }

  const photoPath = `/uploads/${req.file.filename}`;

  // Also record in property_photos for gallery visibility
  await db.insert(propertyPhotosTable).values({
    propertyId: id,
    photoUrl: photoPath,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    photoCategory: "front_view",
    uploadedBy: req.user!.userId,
  });

  const [updated] = await db
    .update(propertiesTable)
    .set({ propertyPhoto: photoPath })
    .where(eq(propertiesTable.id, id))
    .returning();

  res.json(serializeProperty(updated, null));
});

// ─── Approval history ────────────────────────────────────────────────────────

router.get("/properties/:id/approvals", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid property id" }); return; }

  const rows = await db
    .select({
      approval: approvalsTable,
      actor: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(approvalsTable)
    .leftJoin(usersTable, eq(approvalsTable.actorId, usersTable.id))
    .where(eq(approvalsTable.propertyId, id))
    .orderBy(desc(approvalsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r.approval,
      createdAt: r.approval.createdAt.toISOString(),
      actor: r.actor?.id ? r.actor : null,
    })),
  );
});

// ─── Approve ─────────────────────────────────────────────────────────────────

router.post("/properties/:id/approve", requireAuth, requireRole("admin", "city_officer", "kebele_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ApprovePropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const bodyParsed = ApprovePropertyBody.safeParse(req.body);
  const remark = bodyParsed.success ? bodyParsed.data.remark : undefined;

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Property not found" }); return; }

  const userRole = req.user!.role;
  let newStatus = existing.status;
  let action = "approved";

  if (userRole === "kebele_officer" && existing.status === "pending") {
    newStatus = "kebele_verified";
    action = "kebele_verified";
  } else if ((userRole === "city_officer" || userRole === "admin") && ["pending", "kebele_verified"].includes(existing.status)) {
    newStatus = "approved";
    action = "approved";
  } else {
    res.status(400).json({ error: "Cannot approve from current status with your role" });
    return;
  }

  const addressCode = newStatus === "approved"
    ? generateAddressCode(existing.kebele, existing.streetName, existing.blockCode, existing.houseNumber)
    : existing.addressCode;

  const [updated] = await db
    .update(propertiesTable)
    .set({ status: newStatus, addressCode, remark })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  await db.insert(approvalsTable).values({ propertyId: params.data.id, action, actorId: req.user!.userId, remark });
  res.json(serializeProperty(updated, null));
});

// ─── Reject ───────────────────────────────────────────────────────────────────

router.post("/properties/:id/reject", requireAuth, requireRole("admin", "city_officer", "kebele_officer"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RejectPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = RejectPropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(propertiesTable)
    .set({ status: "rejected", remark: parsed.data.remark })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Property not found" }); return; }

  await db.insert(approvalsTable).values({ propertyId: params.data.id, action: "rejected", actorId: req.user!.userId, remark: parsed.data.remark });
  res.json(serializeProperty(updated, null));
});

// ─── Resubmit ─────────────────────────────────────────────────────────────────

router.post("/properties/:id/resubmit", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ResubmitPropertyParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Property not found" }); return; }

  if (existing.status !== "rejected") {
    res.status(400).json({ error: "Only rejected properties can be resubmitted" });
    return;
  }

  const [updated] = await db
    .update(propertiesTable)
    .set({ status: "pending" })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();

  await db.insert(approvalsTable).values({ propertyId: params.data.id, action: "resubmitted", actorId: req.user!.userId });
  res.json(serializeProperty(updated, null));
});

export default router;
