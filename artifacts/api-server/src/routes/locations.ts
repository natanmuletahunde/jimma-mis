import { Router } from "express";
import { db, kebelesTable, streetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListStreetsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/kebeles", requireAuth, async (_req, res): Promise<void> => {
  const kebeles = await db.select().from(kebelesTable).orderBy(kebelesTable.name);
  res.json(kebeles);
});

router.get("/streets", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListStreetsQueryParams.safeParse(req.query);
  if (parsed.success && parsed.data.kebele_id) {
    const streets = await db.select().from(streetsTable).where(eq(streetsTable.kebeleId, parsed.data.kebele_id)).orderBy(streetsTable.name);
    res.json(streets);
  } else {
    const streets = await db.select().from(streetsTable).orderBy(streetsTable.name);
    res.json(streets);
  }
});

export default router;
