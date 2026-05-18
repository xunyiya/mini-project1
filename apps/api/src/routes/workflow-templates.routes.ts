import { Router } from "express";
import { z } from "zod";
import type { WorkflowTemplateCreateInput, WorkflowTemplateUpdateInput } from "@collab/shared";
import { authenticate, requirePermission } from "../middleware/auth";
import { sendSuccess } from "../lib/response";
import {
  createWorkflowTemplate,
  listWorkflowTemplates,
  updateWorkflowTemplate
} from "../services/reviews";

export const workflowTemplatesRoutes = Router();

const templateNodeSchema = z.object({
  nodeName: z.string().trim().min(1, "请输入节点名称"),
  nodeType: z.enum([
    "PRODUCT",
    "TECH",
    "TEST",
    "DESIGN",
    "OPERATION",
    "LEGAL",
    "SECURITY",
    "DATA",
    "CUSTOM"
  ]),
  defaultApproverUserId: z.string().trim().optional(),
  defaultRoleCode: z.string().trim().optional(),
  defaultDepartmentId: z.string().trim().optional(),
  required: z.boolean(),
  orderIndex: z.number(),
  dueInHours: z.number().optional()
});

const templateSchema = z.object({
  name: z.string().trim().min(1, "请输入模板名称"),
  description: z.string().trim(),
  appliesTo: z.literal("REQUIREMENT"),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  nodesConfig: z.array(templateNodeSchema).min(1, "至少配置一个节点")
});

const templateUpdateSchema = templateSchema.partial();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

workflowTemplatesRoutes.get(
  "/",
  authenticate,
  requirePermission("api.workflowTemplates.read"),
  (req, res, next) => {
    try {
      return sendSuccess(res, listWorkflowTemplates(String(req.query.appliesTo ?? "")));
    } catch (error) {
      next(error);
    }
  }
);

workflowTemplatesRoutes.post(
  "/",
  authenticate,
  requirePermission("api.workflowTemplates.create"),
  (req, res, next) => {
    try {
      const input = templateSchema.parse(req.body) as WorkflowTemplateCreateInput;
      return sendSuccess(
        res,
        createWorkflowTemplate(input, req.currentUser!),
        "流程模板已创建",
        "OK",
        201
      );
    } catch (error) {
      next(error);
    }
  }
);

workflowTemplatesRoutes.patch(
  "/:id",
  authenticate,
  requirePermission("api.workflowTemplates.update"),
  (req, res, next) => {
    try {
      const input = templateUpdateSchema.parse(req.body) as WorkflowTemplateUpdateInput;
      return sendSuccess(
        res,
        updateWorkflowTemplate(routeParam(req.params.id), input, req.currentUser!),
        "流程模板已更新"
      );
    } catch (error) {
      next(error);
    }
  }
);
