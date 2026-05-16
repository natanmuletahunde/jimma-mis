import { Router } from "express";
import { db, auditLogsTable, usersTable, propertiesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, count, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { auditReq } from "../lib/audit";

const router = Router();

// ─── Format helper ────────────────────────────────────────────────────────────

type UserRow = { id: number; fullName: string; role: string } | null;
type LogRow = { log: typeof auditLogsTable.$inferSelect; user: UserRow };

function fmt(row: LogRow) {
  return {
    id: row.log.id,
    userId: row.log.userId,
    userName: row.user?.fullName ?? null,
    userRole: row.user?.role ?? null,
    action: row.log.action,
    entityType: row.log.entityType ?? null,
    entityId: row.log.entityId ?? null,
    entityName: row.log.entityName ?? null,
    oldValue: row.log.oldValue ?? null,
    newValue: row.log.newValue ?? null,
    ipAddress: row.log.ipAddress ?? null,
    deviceInfo: row.log.deviceInfo ?? null,
    details: row.log.details ?? null,
    createdAt: row.log.createdAt.toISOString(),
  };
}

// ─── GET /audit-logs/summary ─────────────────────────────────────────────────

router.get("/audit-logs/summary", requireAuth, requireRole("admin", "city_officer"), async (req, res): Promise<void> => {
  const user = req.user!;

  const officerScope = user.role === "city_officer"
    ? [
        "create_property", "update_property", "submit_property", "approve_property",
        "verify_property", "reject_property", "resubmit_property", "delete_property",
        "upload_photo", "delete_photo", "export_report",
        "create_kebele", "update_kebele", "delete_kebele",
        "create_street", "update_street", "delete_street",
        "create_block", "update_block", "delete_block",
      ]
    : null;

  const scopeCond = officerScope ? [inArray(auditLogsTable.action, officerScope)] : [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const withScope = (extra: Parameters<typeof and>[]) =>
    and(...scopeCond, ...extra) ?? undefined;

  const [totalRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(scopeCond.length ? and(...scopeCond) : undefined);
  const [todayRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([gte(auditLogsTable.createdAt, todayStart)]));
  const [loginRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([eq(auditLogsTable.action, "login")]));
  const [propRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([inArray(auditLogsTable.action, ["create_property", "update_property", "submit_property", "delete_property"])]));
  const [approvalRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([inArray(auditLogsTable.action, ["approve_property", "verify_property", "reject_property", "resubmit_property"])]));
  const [userMgmtRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([inArray(auditLogsTable.action, ["create_user", "update_user", "delete_user", "activate_user", "deactivate_user"])]));
  const [exportRow] = await db.select({ c: count() }).from(auditLogsTable)
    .where(withScope([eq(auditLogsTable.action, "export_report")]));

  res.json({
    total: Number(totalRow?.c ?? 0),
    today: Number(todayRow?.c ?? 0),
    logins: Number(loginRow?.c ?? 0),
    propertyChanges: Number(propRow?.c ?? 0),
    approvalActions: Number(approvalRow?.c ?? 0),
    userManagement: Number(userMgmtRow?.c ?? 0),
    reportExports: Number(exportRow?.c ?? 0),
  });
});

// ─── GET /audit-logs ──────────────────────────────────────────────────────────

router.get("/audit-logs", requireAuth, requireRole("admin", "city_officer", "kebele_officer", "enumerator"), async (req, res): Promise<void> => {
  const user = req.user!;
  const {
    action, entity_type, from_date, to_date, user_id, role, search,
    limit: lim = "50", offset: off = "0",
  } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "enumerator") {
    conditions.push(eq(auditLogsTable.userId, user.userId) as ReturnType<typeof eq>);
  } else if (user.role === "kebele_officer") {
    conditions.push(
      inArray(auditLogsTable.entityType, ["property", "kebele", "street", "block"]) as ReturnType<typeof eq>,
    );
  } else if (user.role === "city_officer") {
    conditions.push(
      inArray(auditLogsTable.entityType, ["property", "kebele", "street", "block", "report"]) as ReturnType<typeof eq>,
    );
  }

  if (action) conditions.push(eq(auditLogsTable.action, action) as ReturnType<typeof eq>);
  if (entity_type) conditions.push(eq(auditLogsTable.entityType, entity_type) as ReturnType<typeof eq>);
  if (role) conditions.push(eq(usersTable.role, role) as ReturnType<typeof eq>);

  if (from_date) {
    const d = new Date(from_date);
    if (!isNaN(d.getTime())) conditions.push(gte(auditLogsTable.createdAt, d) as ReturnType<typeof eq>);
  }
  if (to_date) {
    const d = new Date(to_date);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogsTable.createdAt, d) as ReturnType<typeof eq>);
    }
  }
  if (user_id && !isNaN(parseInt(user_id, 10))) {
    conditions.push(eq(auditLogsTable.userId, parseInt(user_id, 10)) as ReturnType<typeof eq>);
  }

  const pageLimit = Math.min(Math.max(parseInt(lim, 10) || 50, 1), 200);
  const pageOffset = Math.max(parseInt(off, 10) || 0, 0);

  const rows = await db
    .select({
      log: auditLogsTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(pageLimit + 1)
    .offset(pageOffset);

  // In-memory search against userName, action, entityName, details
  const filtered = search
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.user?.fullName?.toLowerCase().includes(q) ||
          r.log.action.toLowerCase().includes(q) ||
          r.log.entityName?.toLowerCase().includes(q) ||
          r.log.entityType?.toLowerCase().includes(q) ||
          r.log.details?.toLowerCase().includes(q)
        );
      })
    : rows;

  const hasMore = filtered.length > pageLimit;
  res.json({
    logs: filtered.slice(0, pageLimit).map(fmt),
    hasMore,
  });
});

// ─── GET /audit-logs/:id ──────────────────────────────────────────────────────

router.get("/audit-logs/:id", requireAuth, requireRole("admin", "city_officer", "kebele_officer", "enumerator"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid audit log ID" }); return; }

  const [row] = await db
    .select({
      log: auditLogsTable,
      user: { id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role },
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(eq(auditLogsTable.id, id));

  if (!row) { res.status(404).json({ error: "Audit log not found" }); return; }
  res.json(fmt(row));
});

// ─── POST /audit-logs/track (client-side events, e.g. CSV exports) ───────────

router.post("/audit-logs/track", requireAuth, async (req, res): Promise<void> => {
  const { action, entityType, entityName, details } = req.body as Record<string, string>;
  if (!action) { res.status(400).json({ error: "action is required" }); return; }
  await auditReq(req, req.user!.userId, action, {
    entityType: entityType ?? "report",
    entityName: entityName ?? null,
    details: details ?? null,
  });
  res.sendStatus(201);
});

export default router;
