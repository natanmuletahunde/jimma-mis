import { Router, type IRouter } from "express";
import { testConnection } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  const db = await testConnection();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? "ok" : "degraded",
    databaseStatus: db.ok ? "connected" : `error: ${db.error}`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
