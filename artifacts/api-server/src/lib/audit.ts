import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export function getDeviceInfo(req: Request): string {
  return (req.headers["user-agent"] ?? "unknown").slice(0, 512);
}

export interface AuditEntry {
  userId: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  entityName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  details?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      entityName: entry.entityName ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      ipAddress: entry.ipAddress ?? null,
      deviceInfo: entry.deviceInfo ?? null,
      details: entry.details ?? null,
    });
  } catch {
    // Audit failures must never break the main request
  }
}

export function auditReq(
  req: Request,
  userId: number | null,
  action: string,
  extra?: Omit<AuditEntry, "userId" | "action" | "ipAddress" | "deviceInfo">,
): Promise<void> {
  return writeAudit({
    userId,
    action,
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req),
    ...extra,
  });
}
