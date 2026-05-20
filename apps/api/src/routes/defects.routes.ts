import { Router } from "express";
import { z } from "zod";
import type { BugTicketCreateInput, BugTicketUpdateInput } from "@collab/shared";
import { BUG_SEVERITIES, BUG_STATUSES, REQUIREMENT_PRIORITIES } from "@collab/shared";
import { parsePagination, paginate } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import { authenticate, requirePermission } from "../middleware/auth";
import {
  createBugTicket,
  getBugTicket,
  listBugTickets,
  updateBugTicket
} from "../services/defects";

export const defectsRoutes = Router();

const bugTicketInputSchema = z.object({
  title: z.string().trim().min(2, "bug标题需为 2-100 字").max(100, "bug标题需为 2-100 字"),
  severity: z.enum(BUG_SEVERITIES as [string, ...string[]]),
  priority: z.enum(REQUIREMENT_PRIORITIES as [string, ...string[]]),
  status: z.enum(BUG_STATUSES as [string, ...string[]]).optional(),
  requirementId: z.string().trim().min(1, "请选择关联需求"),
  projectId: z.string().trim().min(1, "请选择对应项目"),
  finderId: z.string().trim().min(1, "请选择发现人"),
  handlerId: z.string().trim().min(1, "请选择处理人"),
  relatedUserIds: z.array(z.string().trim()).optional(),
  description: z.string().trim().optional()
});

const bugTicketUpdateSchema = bugTicketInputSchema.partial();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeListQuery(query: Record<string, unknown>) {
  return {
    search: String(query.search ?? "").trim(),
    status: String(query.status ?? "").trim(),
    severity: String(query.severity ?? "").trim(),
    priority: String(query.priority ?? "").trim(),
    requirementId: String(query.requirementId ?? "").trim(),
    projectId: String(query.projectId ?? "").trim(),
    finderId: String(query.finderId ?? "").trim(),
    handlerId: String(query.handlerId ?? "").trim(),
    relatedUserId: String(query.relatedUserId ?? "").trim()
  };
}

defectsRoutes.get(
  "/",
  authenticate,
  requirePermission("api.defects.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const items = listBugTickets(normalizeListQuery(req.query), req.currentUser!);

      return sendSuccess(res, paginate(items, page, pageSize));
    } catch (error) {
      next(error);
    }
  }
);

defectsRoutes.post(
  "/",
  authenticate,
  requirePermission("api.defects.create"),
  (req, res, next) => {
    try {
      const input = bugTicketInputSchema.parse(req.body) as BugTicketCreateInput;
      const bugTicket = createBugTicket(input, req.currentUser!, req.traceId);

      return sendSuccess(res, bugTicket, "bug单已创建", "OK", 201);
    } catch (error) {
      next(error);
    }
  }
);

defectsRoutes.get(
  "/:id",
  authenticate,
  requirePermission("api.defects.read"),
  (req, res, next) => {
    try {
      return sendSuccess(res, getBugTicket(routeParam(req.params.id), req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

defectsRoutes.patch(
  "/:id",
  authenticate,
  requirePermission("api.defects.update"),
  (req, res, next) => {
    try {
      const input = bugTicketUpdateSchema.parse(req.body) as BugTicketUpdateInput;
      const bugTicket = updateBugTicket(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, bugTicket, "bug单已更新");
    } catch (error) {
      next(error);
    }
  }
);
