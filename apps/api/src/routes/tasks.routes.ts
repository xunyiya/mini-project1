import { Router } from "express";
import { z } from "zod";
import type { TaskDependenciesInput, TaskStatusInput, TaskUpdateInput } from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES
} from "@collab/shared";
import { parsePagination, paginate } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import { authenticate, requirePermission } from "../middleware/auth";
import {
  getRequirementTaskBoard,
  getTask,
  listMyTasks,
  setTaskDependencies,
  updateTask,
  updateTaskStatus
} from "../services/projects";

export const tasksRoutes = Router();

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2, "任务标题需为 2-100 字").max(100, "任务标题需为 2-100 字").optional(),
  description: z.string().trim().optional(),
  taskType: z.enum(TASK_TYPES as [string, ...string[]]).optional(),
  priority: z.enum(REQUIREMENT_PRIORITIES as [string, ...string[]]).optional(),
  assigneeId: z.string().trim().min(1, "请选择任务负责人").optional(),
  departmentId: z.string().trim().min(1, "请选择负责部门").optional(),
  startDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  dependencyTaskIds: z.array(z.string().trim()).optional()
});

const taskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES as [string, ...string[]]),
  reason: z.string().trim().optional(),
  blockerReason: z.string().trim().optional()
});

const taskDependenciesSchema = z.object({
  dependencyTaskIds: z.array(z.string().trim())
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

tasksRoutes.get(
  "/board",
  authenticate,
  requirePermission("api.tasks.read"),
  (req, res, next) => {
    try {
      const projectId = String(req.query.projectId ?? "").trim() || undefined;
      return sendSuccess(res, getRequirementTaskBoard(req.currentUser!, projectId));
    } catch (error) {
      next(error);
    }
  }
);

tasksRoutes.get(
  "/my",
  authenticate,
  requirePermission("api.tasks.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      return sendSuccess(res, paginate(listMyTasks(req.currentUser!), page, pageSize));
    } catch (error) {
      next(error);
    }
  }
);

tasksRoutes.get(
  "/:id",
  authenticate,
  requirePermission("api.tasks.read"),
  (req, res, next) => {
    try {
      return sendSuccess(res, getTask(routeParam(req.params.id), req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

tasksRoutes.patch(
  "/:id",
  authenticate,
  requirePermission("api.tasks.update"),
  (req, res, next) => {
    try {
      const input = taskUpdateSchema.parse(req.body) as TaskUpdateInput;
      const task = updateTask(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, task, "任务已更新");
    } catch (error) {
      next(error);
    }
  }
);

tasksRoutes.post(
  "/:id/status",
  authenticate,
  requirePermission("api.tasks.update"),
  (req, res, next) => {
    try {
      const input = taskStatusSchema.parse(req.body) as TaskStatusInput;
      const task = updateTaskStatus(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, task, "任务状态已更新");
    } catch (error) {
      next(error);
    }
  }
);

tasksRoutes.post(
  "/:id/dependencies",
  authenticate,
  requirePermission("api.tasks.update"),
  (req, res, next) => {
    try {
      const input = taskDependenciesSchema.parse(req.body) as TaskDependenciesInput;
      const task = setTaskDependencies(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, task, "任务依赖已更新");
    } catch (error) {
      next(error);
    }
  }
);
