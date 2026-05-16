import { Router } from "express";
import { db, propertiesTable } from "@workspace/db";
import { eq, and, isNotNull, isNull, or, ilike } from "drizzle-orm";
import { GetMapPropertiesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── GET /map/properties ─────────────────────────────────────────────────────

router.get("/map/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetMapPropertiesQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [
    isNotNull(propertiesTable.latitude) as ReturnType<typeof eq>,
    isNotNull(propertiesTable.longitude) as ReturnType<typeof eq>,
  ];

  if (parsed.success) {
    const { kebele, status, property_type, search } = parsed.data;
    if (kebele) conditions.push(eq(propertiesTable.kebele, kebele) as ReturnType<typeof eq>);
    if (status) conditions.push(eq(propertiesTable.status, status) as ReturnType<typeof eq>);
    if (property_type) conditions.push(eq(propertiesTable.propertyType, property_type) as ReturnType<typeof eq>);
    if (search) {
      conditions.push(
        or(
          ilike(propertiesTable.addressCode, `%${search}%`),
          ilike(propertiesTable.ownerName, `%${search}%`),
          ilike(propertiesTable.houseNumber, `%${search}%`),
          ilike(propertiesTable.businessName, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }
  }

  // Role-based: enumerators only see own properties
  const user = req.user!;
  if (user.role === "enumerator") {
    conditions.push(eq(propertiesTable.createdBy, user.userId) as ReturnType<typeof eq>);
  }

  const rows = await db.select().from(propertiesTable).where(and(...conditions));

  res.json(
    rows.map((r) => ({
      id: r.id,
      addressCode: r.addressCode,
      propertyType: r.propertyType,
      status: r.status,
      latitude: r.latitude,
      longitude: r.longitude,
      ownerName: r.ownerName,
      ownerPhone: r.ownerPhone,
      businessName: r.businessName,
      ownershipType: r.ownershipType,
      buildingName: r.buildingName,
      kebele: r.kebele,
      streetName: r.streetName,
      blockCode: r.blockCode,
      houseNumber: r.houseNumber,
      propertyPhoto: r.propertyPhoto,
    })),
  );
});

// ─── GET /map/summary ────────────────────────────────────────────────────────

router.get("/map/summary", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  // Base set for enumerators
  const allRows = await db.select().from(propertiesTable).where(
    user.role === "enumerator" ? eq(propertiesTable.createdBy, user.userId) : undefined,
  );

  const total = allRows.length;
  const residential = allRows.filter((r) => r.propertyType === "residential").length;
  const commercial = allRows.filter((r) => r.propertyType === "commercial").length;
  const approved = allRows.filter((r) => r.status === "approved").length;
  const pending = allRows.filter((r) => r.status === "pending").length;

  const missingGpsList = allRows
    .filter((r) => !r.latitude || !r.longitude)
    .map((r) => ({
      id: r.id,
      ownerName: r.ownerName,
      kebele: r.kebele,
      streetName: r.streetName,
      houseNumber: r.houseNumber,
      status: r.status,
    }));

  res.json({
    total,
    residential,
    commercial,
    approved,
    pending,
    missingGps: missingGpsList.length,
    missingGpsList,
  });
});

export default router;
