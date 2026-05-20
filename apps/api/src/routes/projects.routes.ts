import { Router } from "express";
import { z } from "zod";
import type { ProjectCreateInput, ProjectUpdateInput, TaskCreateInput } from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  TASK_TYPES
} from "@collab/shared";
import { parsePagination, paginate } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import { authenticate, requirePermission } from "../middleware/auth";
import {
  completeProject,
  createProject,
  createTask,
  getProject,
  listProjectTasks,
  listProjectOptions,
  listProjects,
  startProject,
  updateProject
} from "../services/projects";

export const projectsRoutes = Router();

const projectInputSchema = z.object({
  requirementId: z.string().trim().min(1, "请选择关联需求"),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  ownerId: z.string().trim().min(1, "请选择项目负责人"),
  participantDepartmentIds: z.array(z.string().trim()).optional(),
  plannedStartDate: z.string().trim().optional(),
  plannedEndDate: z.string().trim().optional(),
  plannedReleaseDate: z.string().trim().optional()
});

const projectUpdateSchema = projectInputSchema.omit({ requirementId: true }).partial();

const taskInputSchema = z.object({
  title: z.string().trim().min(2, "任务标题需为 2-100 字").max(100, "任务标题需为 2-100 字"),
  description: z.string().trim().optional(),
  taskType: z.enum(TASK_TYPES as [string, ...string[]]),
  priority: z.enum(REQUIREMENT_PRIORITIES as [string, ...string[]]).optional(),
  assigneeId: z.string().trim().min(1, "请选择任务负责人"),
  departmentId: z.string().trim().min(1, "请选择负责部门"),
  startDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  dependencyTaskIds: z.array(z.string().trim()).optional()
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeListQuery(query: Record<string, unknown>) {
  const dateRange = String(query.dateRange ?? "").trim();
  const [rangeStart, rangeEnd] = dateRange ? dateRange.split(",") : [];

  return {
    status: String(query.status ?? "").trim(),
    ownerId: String(query.ownerId ?? "").trim(),
    departmentId: String(query.departmentId ?? "").trim(),
    dateFrom: String(query.dateFrom ?? query.createdFrom ?? rangeStart ?? "").trim(),
    dateTo: String(query.dateTo ?? query.createdTo ?? rangeEnd ?? "").trim()
  };
}

projectsRoutes.get(
  "/options",
  authenticate,
  (req, res, next) => {
    try {
      return sendSuccess(res, listProjectOptions());
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.get(
  "/",
  authenticate,
  requirePermission("api.projects.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const items = listProjects(normalizeListQuery(req.query), req.currentUser!);

      return sendSuccess(res, paginate(items, page, pageSize));
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.post(
  "/",
  authenticate,
  requirePermission("api.projects.create"),
  (req, res, next) => {
    try {
      const input = projectInputSchema.parse(req.body) as ProjectCreateInput;
      const project = createProject(input, req.currentUser!, req.traceId);

      return sendSuccess(res, project, "项目已创建", "OK", 201);
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.get(
  "/:id",
  authenticate,
  requirePermission("api.projects.read"),
  (req, res, next) => {
    try {
      return sendSuccess(res, getProject(routeParam(req.params.id), req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.patch(
  "/:id",
  authenticate,
  requirePermission("api.projects.update"),
  (req, res, next) => {
    try {
      const input = projectUpdateSchema.parse(req.body) as ProjectUpdateInput;
      const project = updateProject(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, project, "项目已更新");
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.post(
  "/:id/start",
  authenticate,
  requirePermission("api.projects.update"),
  (req, res, next) => {
    try {
      const project = startProject(routeParam(req.params.id), req.currentUser!, req.traceId);

      return sendSuccess(res, project, "项目已启动");
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.post(
  "/:id/complete",
  authenticate,
  requirePermission("api.projects.update"),
  (req, res, next) => {
    try {
      const project = completeProject(routeParam(req.params.id), req.currentUser!, req.traceId);

      return sendSuccess(res, project, "项目已完成");
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.get(
  "/:id/tasks",
  authenticate,
  requirePermission("api.tasks.read"),
  (req, res, next) => {
    try {
      return sendSuccess(res, listProjectTasks(routeParam(req.params.id), req.currentUser!));
    } catch (error) {
      next(error);
    }
  }
);

projectsRoutes.post(
  "/:id/tasks",
  authenticate,
  requirePermission("api.tasks.create"),
  (req, res, next) => {
    try {
      const input = taskInputSchema.parse(req.body) as TaskCreateInput;
      const task = createTask(routeParam(req.params.id), input, req.currentUser!, req.traceId);

      return sendSuccess(res, task, "任务已创建", "OK", 201);
    } catch (error) {
      next(error);
    }
  }
);
