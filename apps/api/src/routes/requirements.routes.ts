import { Router } from "express";
import { z } from "zod";
import type { RequirementCreateInput, RequirementUpdateInput } from "@collab/shared";
import type { SubmitReviewInput } from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_SOURCES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
  REVIEW_NODE_TYPE_LABELS
} from "@collab/shared";
import { authenticate, requirePermission } from "../middleware/auth";
import { parsePagination, paginate } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import {
  assertCanViewRequirement,
  createRequirement,
  getRequirementHistories,
  listRequirements,
  requireRequirement,
  toRequirementView,
  updateRequirement,
  withdrawRequirement
} from "../services/requirements";
import { getRequirementReviews, startRequirementReview } from "../services/reviews";

export const requirementsRoutes = Router();

const attachmentSchema = z.object({
  name: z.string().trim().min(1, "请输入附件名称").max(80, "附件名称最多 80 个字符"),
  url: z.string().trim().min(1, "请输入附件链接").max(500, "附件链接最多 500 个字符")
});

const reviewApproverAssignmentsSchema = z
  .record(z.string().trim().min(1), z.string().trim().min(1))
  .optional();

const projectMemberSchema = z.object({
  role: z.enum(["FRONTEND", "BACKEND", "TEST", "PRODUCT", "UI_DESIGN", "OTHER"]),
  userId: z.string().trim().min(1, "请选择项目相关人")
});

const requirementInputSchema = z.object({
  title: z.string().trim().min(2, "需求标题需为 2-100 字").max(100, "需求标题需为 2-100 字"),
  description: z.string().trim().min(1, "请填写需求描述"),
  background: z.string().trim().optional(),
  goal: z.string().trim().optional(),
  source: z.enum(REQUIREMENT_SOURCES as [string, ...string[]]).optional(),
  type: z.enum(REQUIREMENT_TYPES as [string, ...string[]]).optional(),
  priority: z.enum(REQUIREMENT_PRIORITIES as [string, ...string[]]).optional(),
  projectId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  expectedReleaseDate: z.string().trim().optional(),
  relatedDepartments: z.array(z.string().trim()).optional(),
  impactScope: z.string().trim().optional(),
  successMetric: z.string().trim().optional(),
  attachments: z.array(attachmentSchema).optional(),
  reviewApproverAssignments: reviewApproverAssignmentsSchema,
  projectMembers: z.array(projectMemberSchema).optional()
});

const requirementUpdateSchema = requirementInputSchema.partial().extend({
  status: z.enum(REQUIREMENT_STATUSES as [string, ...string[]]).optional()
});
const submitReviewSchema = z.object({
  templateId: z.string().trim().optional(),
  approverAssignments: z.record(z.string().trim(), z.string().trim()).optional(),
  reviewKind: z.enum(["INITIAL", "CHANGE"]).optional(),
  nodeTypes: z.array(z.enum(Object.keys(REVIEW_NODE_TYPE_LABELS) as [string, ...string[]])).optional()
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeListQuery(query: Record<string, unknown>) {
  const dateRange = String(query.dateRange ?? "").trim();
  const [rangeStart, rangeEnd] = dateRange ? dateRange.split(",") : [];

  return {
    search: String(query.search ?? query.q ?? "").trim(),
    status: String(query.status ?? "").trim(),
    priority: String(query.priority ?? "").trim(),
    type: String(query.type ?? "").trim(),
    projectId: String(query.projectId ?? "").trim(),
    departmentId: String(query.departmentId ?? "").trim(),
    ownerId: String(query.ownerId ?? "").trim(),
    dateFrom: String(query.dateFrom ?? query.createdFrom ?? rangeStart ?? "").trim(),
    dateTo: String(query.dateTo ?? query.createdTo ?? rangeEnd ?? "").trim(),
    sortBy: String(query.sortBy ?? "").trim(),
    sortOrder: String(query.sortOrder ?? "").trim()
  };
}

requirementsRoutes.get(
  "/",
  authenticate,
  requirePermission("api.requirements.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const items = listRequirements(normalizeListQuery(req.query), req.currentUser!);

      return sendSuccess(res, paginate(items, page, pageSize));
    } catch (error) {
      next(error);
    }
  }
);

requirementsRoutes.post(
  "/",
  authenticate,
  requirePermission("api.requirements.create"),
  (req, res, next) => {
    try {
      const input = requirementInputSchema.parse(req.body) as RequirementCreateInput;
      const requirement = createRequirement(input, req.currentUser!, req.traceId);

      return sendSuccess(res, requirement, "需求草稿已创建", "OK", 201);
    } catch (error) {
      next(error);
    }
  }
);

requirementsRoutes.get(
  "/:id",
  authenticate,
  requirePermission("api.requirements.read"),
  (req, res, next) => {
    try {
      const requirement = requireRequirement(routeParam(req.params.id));
      assertCanViewRequirement(req.currentUser!, requirement);

      return sendSuccess(res, toRequirementView(requirement, req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

requirementsRoutes.patch("/:id", authenticate, (req, res, next) => {
  try {
    const input = requirementUpdateSchema.parse(req.body) as RequirementUpdateInput;
    const requirement = updateRequirement(routeParam(req.params.id), input, req.currentUser!, req.traceId);

    return sendSuccess(res, requirement, "需求已更新");
  } catch (error) {
    next(error);
  }
});

requirementsRoutes.post("/:id/submit-review", authenticate, (req, res, next) => {
  try {
    const input = submitReviewSchema.parse(req.body ?? {}) as SubmitReviewInput;
    const requirement = startRequirementReview(
      routeParam(req.params.id),
      req.currentUser!,
      req.traceId,
      input
    );

    return sendSuccess(res, requirement, "需求已进入评审流程");
  } catch (error) {
    next(error);
  }
});

requirementsRoutes.post("/:id/withdraw", authenticate, (req, res, next) => {
  try {
    const requirement = withdrawRequirement(routeParam(req.params.id), req.currentUser!, req.traceId);

    return sendSuccess(res, requirement, "需求已撤回");
  } catch (error) {
    next(error);
  }
});

requirementsRoutes.get(
  "/:id/reviews",
  authenticate,
  requirePermission("api.reviews.read"),
  (req, res, next) => {
    try {
      const requirement = requireRequirement(routeParam(req.params.id));
      assertCanViewRequirement(req.currentUser!, requirement);

      return sendSuccess(res, getRequirementReviews(requirement.id, req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

requirementsRoutes.get(
  "/:id/history",
  authenticate,
  requirePermission("api.requirements.read"),
  (req, res, next) => {
    try {
      const requirement = requireRequirement(routeParam(req.params.id));
      assertCanViewRequirement(req.currentUser!, requirement);

      return sendSuccess(res, getRequirementHistories(requirement.id));
    } catch (error) {
      next(error);
    }
  }
);
