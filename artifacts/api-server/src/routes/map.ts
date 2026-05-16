import { Router } from "express";
import { db, propertiesTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { GetMapPropertiesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/map/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetMapPropertiesQueryParams.safeParse(req.query);
  const conditions = [isNotNull(propertiesTable.latitude), isNotNull(propertiesTable.longitude)];
  if (parsed.success) {
    if (parsed.data.kebele) conditions.push(eq(propertiesTable.kebele, parsed.data.kebele));
    if (parsed.data.status) conditions.push(eq(propertiesTable.status, parsed.data.status));
    if (parsed.data.property_type) conditions.push(eq(propertiesTable.propertyType, parsed.data.property_type));
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
      buildingName: r.buildingName,
      kebele: r.kebele,
      streetName: r.streetName,
      houseNumber: r.houseNumber,
    }))
  );
});

export default router;
