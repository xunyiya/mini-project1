import crypto from "node:crypto";
import type { AuditLog } from "@collab/shared";
import { getStore } from "../data/store";

export type AuditInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  traceId: string;
};

export function writeAuditLog(input: AuditInput): AuditLog {
  const auditLog: AuditLog = {
    id: `audit_${crypto.randomUUID()}`,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    traceId: input.traceId,
    createdAt: new Date().toISOString(),
    isSeed: true
  };

  getStore().auditLogs.unshift(auditLog);
  return auditLog;
}
