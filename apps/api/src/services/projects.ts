import crypto from "node:crypto";
import type {
  Department,
  Project,
  ProjectCreateInput,
  ProjectStatus,
  ProjectTaskBoard,
  ProjectUpdateInput,
  ProjectView,
  Requirement,
  RequirementProjectMemberRole,
  RequirementStatus,
  RequirementTaskBoard,
  RequirementTaskBoardColumn,
  RequirementTaskBoardItem,
  ReviewNode,
  Task,
  TaskCreateInput,
  TaskDependenciesInput,
  TaskStatus,
  TaskStatusHistory,
  TaskStatusInput,
  TaskUpdateInput,
  TaskView
} from "@collab/shared";
import { TASK_STATUSES } from "@collab/shared";
import { getStore, type StoredUser } from "../data/store";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { writeAuditLog } from "./audit";
import { createNotification, createNotifications } from "./notifications";
import { getUserRoles, isAdmin, toSafeUser } from "./rbac";
import { appendStatusHistory, requireRequirement } from "./requirements";

export type ProjectListQuery = {
  status?: string;
  ownerId?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const projectStatusTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "CANCELED"],
  BLOCKED: ["IN_PROGRESS", "CANCELED"],
  DONE: ["ARCHIVED"],
  CANCELED: [],
  ARCHIVED: []
};

const taskStatusTransitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "BLOCKED", "CANCELED"],
  IN_PROGRESS: ["DONE", "BLOCKED", "CANCELED"],
  BLOCKED: ["IN_PROGRESS", "CANCELED"],
  DONE: [],
  CANCELED: []
};
const requirementLifecycleOrder: RequirementStatus[] = [
  "APPROVED",
  "SCHEDULED",
  "PLANNING_DONE",
  "UI_DESIGNING",
  "UI_DESIGN_DONE",
  "IN_DEVELOPMENT",
  "DEVELOPMENT_DONE",
  "IN_TESTING",
  "TESTING_DONE",
  "ACCEPTANCE",
  "ACCEPTANCE_DONE",
  "PENDING_RELEASE",
  "RELEASED",
  "DELIVERED",
  "ARCHIVED"
];
const roleStageIndex: Partial<
  Record<RequirementProjectMemberRole, { start: number; done: number; label: string }>
> = {
  PRODUCT: { start: 1, done: 2, label: "产品相关人" },
  UI_DESIGN: { start: 3, done: 4, label: "UI设计相关人" },
  FRONTEND: { start: 5, done: 6, label: "前端相关人" },
  BACKEND: { start: 5, done: 6, label: "后端相关人" },
  TEST: { start: 7, done: 8, label: "测试相关人" },
  OTHER: { start: 9, done: 13, label: "项目相关人" }
};

function hasAnyRole(user: StoredUser, roleCodes: string[]) {
  const roleCodeSet = new Set(roleCodes);
  return getUserRoles(user).some((role) => roleCodeSet.has(role.code));
}

function isProjectCoordinator(user: StoredUser) {
  return isAdmin(user) || hasAnyRole(user, ["product_manager", "project_manager"]);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function summarizeUser(userId?: string) {
  if (!userId) {
    return null;
  }

  const user = getStore().users.find((item) => item.id === userId && item.status === "active");

  if (!user) {
    return null;
  }

  const safeUser = toSafeUser(user);
  return {
    id: safeUser.id,
    username: safeUser.username,
    displayName: safeUser.displayName,
    title: safeUser.title
  };
}

function summarizeDepartment(departmentId?: string) {
  if (!departmentId) {
    return null;
  }

  const department = getStore().departments.find((item) => item.id === departmentId);

  if (!department) {
    return null;
  }

  return {
    id: department.id,
    name: department.name,
    code: department.code
  };
}

function summarizeRequirement(requirementId?: string) {
  if (!requirementId) {
    return null;
  }

  const requirement = getStore().requirements.find((item) => item.id === requirementId);

  if (!requirement) {
    return null;
  }

  return {
    id: requirement.id,
    code: requirement.code,
    title: requirement.title,
    status: requirement.status
  };
}

function getRequirementProject(requirementId: string) {
  return (
    getStore()
      .projects.filter((project) => project.requirementId === requirementId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null
  );
}

function getLatestRequirementFlow(requirementId: string) {
  return (
    getStore()
      .reviewFlows.filter((flow) => flow.requirementId === requirementId)
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0] ?? null
  );
}

function getFlowNodes(flowId?: string) {
  if (!flowId) {
    return [];
  }

  return getStore()
    .reviewNodes.filter((node) => node.flowId === flowId)
    .sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id));
}

function requireProject(projectId: string) {
  const project = getStore().projects.find((item) => item.id === projectId);

  if (!project) {
    throw notFound("项目不存在");
  }

  return project;
}

export function requireTask(taskId: string) {
  const task = getStore().tasks.find((item) => item.id === taskId);

  if (!task) {
    throw notFound("任务不存在");
  }

  return task;
}

function assertActiveUser(userId: string, message: string) {
  const user = getStore().users.find((item) => item.id === userId && item.status === "active");

  if (!user) {
    throw badRequest(message);
  }

  return user;
}

function assertDepartments(departmentIds: string[]) {
  const missingDepartmentIds = departmentIds.filter(
    (departmentId) => !getStore().departments.some((item) => item.id === departmentId)
  );

  if (missingDepartmentIds.length > 0) {
    throw badRequest(`部门不存在：${missingDepartmentIds.join(", ")}`);
  }
}

function canCreateProject(user: StoredUser, requirement: Requirement) {
  return requirement.ownerId === user.id || isProjectCoordinator(user);
}

function canManageProject(user: StoredUser, project: Project) {
  return project.ownerId === user.id || isProjectCoordinator(user);
}

function isProjectParticipant(user: StoredUser, project: Project) {
  return project.ownerId === user.id || project.participantDepartmentIds.includes(user.departmentId);
}

function canManageTaskByDomain(user: StoredUser, task: Task) {
  if (["FRONTEND", "BACKEND", "DATA", "SECURITY"].includes(task.taskType)) {
    return hasAnyRole(user, ["engineering_lead"]);
  }

  if (task.taskType === "TEST") {
    return hasAnyRole(user, ["tester"]);
  }

  if (task.taskType === "DESIGN") {
    return hasAnyRole(user, ["designer"]);
  }

  if (task.taskType === "PRODUCT") {
    return hasAnyRole(user, ["product_manager", "project_manager"]);
  }

  if (task.taskType === "OPERATION") {
    return hasAnyRole(user, ["ops_support"]);
  }

  if (["LEGAL", "OTHER"].includes(task.taskType)) {
    return hasAnyRole(user, ["special_reviewer", "project_manager"]);
  }

  return false;
}

function canManageTask(user: StoredUser, task: Task) {
  const project = requireProject(task.projectId);

  return (
    isAdmin(user) ||
    canManageProject(user, project) ||
    task.assigneeId === user.id ||
    (isProjectParticipant(user, project) && canManageTaskByDomain(user, task))
  );
}

function projectAvailableActions(project: Project, currentUser: StoredUser): ProjectView["availableActions"] {
  const actions: ProjectView["availableActions"] = ["view"];

  if (canManageProject(currentUser, project)) {
    actions.push("edit", "createTask");

    if (project.status === "PLANNING") {
      actions.push("start");
    }

    if (project.status === "IN_PROGRESS") {
      actions.push("complete");
    }
  }

  return actions;
}

function taskAvailableActions(task: Task, currentUser: StoredUser): TaskView["availableActions"] {
  const actions: TaskView["availableActions"] = ["view"];

  if (canManageTask(currentUser, task)) {
    actions.push("edit", "updateStatus", "setDependencies");
  }

  return actions;
}

function getProjectTaskStats(projectId: string) {
  const tasks = getStore().tasks.filter((task) => task.projectId === projectId);
  const stats = TASK_STATUSES.reduce(
    (result, status) => ({
      ...result,
      [status]: tasks.filter((task) => task.status === status).length
    }),
    {} as Record<TaskStatus, number>
  );
  const completed = stats.DONE;
  const completionRate = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

  return {
    tasks,
    stats,
    completionRate
  };
}

export function toProjectView(project: Project, currentUser: StoredUser): ProjectView {
  const { tasks, stats, completionRate } = getProjectTaskStats(project.id);
  const participantDepartments = project.participantDepartmentIds
    .map((departmentId) => summarizeDepartment(departmentId))
    .filter((department): department is Pick<Department, "id" | "name" | "code"> =>
      Boolean(department)
    );

  return {
    ...project,
    requirement: summarizeRequirement(project.requirementId),
    owner: summarizeUser(project.ownerId),
    creator: summarizeUser(project.createdBy),
    participantDepartments,
    progress: completionRate,
    taskStats: stats,
    taskCompletionRate: completionRate,
    riskCount: tasks.filter((task) => task.status === "BLOCKED").length,
    availableActions: projectAvailableActions(project, currentUser)
  };
}

export function toTaskView(task: Task, currentUser: StoredUser): TaskView {
  const project = getStore().projects.find((item) => item.id === task.projectId) ?? null;
  const dependencies = task.dependencyTaskIds
    .map((taskId) => getStore().tasks.find((item) => item.id === taskId))
    .filter((item): item is Task => Boolean(item))
    .map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      status: item.status
    }));
  const statusHistories = getStore()
    .taskStatusHistories.filter((history) => history.taskId === task.id)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const dueAt = task.dueDate ? new Date(`${task.dueDate}T23:59:59.999Z`) : null;
  const overdue = Boolean(
    dueAt && dueAt.getTime() < Date.now() && !["DONE", "CANCELED"].includes(task.status)
  );

  return {
    ...task,
    project: project
      ? {
          id: project.id,
          code: project.code,
          name: project.name,
          status: project.status,
          ownerId: project.ownerId
        }
      : null,
    requirement: summarizeRequirement(task.requirementId),
    assignee: summarizeUser(task.assigneeId),
    department: summarizeDepartment(task.departmentId),
    dependencies,
    statusHistories,
    availableActions: taskAvailableActions(task, currentUser),
    overdue
  };
}

function parseListFilter(value?: string) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function listProjects(query: ProjectListQuery, currentUser: StoredUser) {
  const statusFilter = parseListFilter(query.status);
  const ownerId = normalizeString(query.ownerId);
  const departmentId = normalizeString(query.departmentId);
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;

  return getStore()
    .projects.filter((project) => statusFilter.size === 0 || statusFilter.has(project.status))
    .filter((project) => !ownerId || project.ownerId === ownerId)
    .filter(
      (project) => !departmentId || project.participantDepartmentIds.includes(departmentId)
    )
    .filter((project) => {
      const createdAt = new Date(project.createdAt);

      if (dateFrom && createdAt < dateFrom) {
        return false;
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);

        if (createdAt > endOfDay) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((project) => toProjectView(project, currentUser));
}

function generateProjectCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `PROJ-${datePart}-`;
  const maxSerial = getStore()
    .projects.filter((project) => project.code.startsWith(prefix))
    .map((project) => Number(project.code.slice(prefix.length)))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `${prefix}${String(maxSerial + 1).padStart(4, "0")}`;
}

function generateTaskCode() {
  const maxSerial = getStore()
    .tasks.map((task) => Number(task.code.replace(/^TASK-/, "")))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `TASK-${String(maxSerial + 1).padStart(4, "0")}`;
}

function assertProjectInput(input: ProjectCreateInput | ProjectUpdateInput) {
  if (input.ownerId) {
    assertActiveUser(input.ownerId, "项目负责人不存在或已停用");
  }

  if (input.participantDepartmentIds) {
    assertDepartments(input.participantDepartmentIds);
  }
}

function normalizeParticipantDepartments(requirement: Requirement, input: ProjectCreateInput) {
  const departmentIds = input.participantDepartmentIds?.length
    ? input.participantDepartmentIds
    : [requirement.departmentId, ...requirement.relatedDepartments].filter(
        (departmentId): departmentId is string => Boolean(departmentId)
      );

  return Array.from(new Set(departmentIds));
}

export function createProject(input: ProjectCreateInput, currentUser: StoredUser, traceId: string) {
  const requirement = requireRequirement(input.requirementId);

  if (requirement.status !== "APPROVED") {
    throw badRequest("只有已通过需求可以创建项目");
  }

  if (!canCreateProject(currentUser, requirement)) {
    throw forbidden("没有权限从该需求创建项目");
  }

  assertProjectInput(input);
  const participantDepartmentIds = normalizeParticipantDepartments(requirement, input);
  assertDepartments(participantDepartmentIds);

  const now = new Date().toISOString();
  const project: Project = {
    id: `proj_${crypto.randomUUID()}`,
    code: generateProjectCode(),
    name: normalizeString(input.name) || requirement.title,
    requirementId: requirement.id,
    description: normalizeString(input.description) || requirement.goal || requirement.background,
    ownerId: input.ownerId,
    status: "PLANNING",
    participantDepartmentIds,
    plannedStartDate: input.plannedStartDate || undefined,
    plannedEndDate: input.plannedEndDate || undefined,
    plannedReleaseDate: input.plannedReleaseDate || requirement.expectedReleaseDate,
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    isSeed: true
  };

  getStore().projects.unshift(project);

  const fromStatus = requirement.status;
  requirement.status = "SCHEDULED";
  requirement.updatedAt = now;
  appendStatusHistory(requirement, fromStatus, requirement.status, currentUser.id, "创建项目空间");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "project.create",
    targetType: "Project",
    targetId: project.id,
    summary: `创建项目 ${project.code}`,
    traceId
  });

  return toProjectView(project, currentUser);
}

export function getProject(projectId: string, currentUser: StoredUser) {
  return toProjectView(requireProject(projectId), currentUser);
}

export function updateProject(
  projectId: string,
  input: ProjectUpdateInput,
  currentUser: StoredUser,
  traceId: string
) {
  const project = requireProject(projectId);

  if (!canManageProject(currentUser, project)) {
    throw forbidden("没有权限编辑该项目");
  }

  assertProjectInput(input);

  if (input.name !== undefined) {
    project.name = normalizeString(input.name);
  }

  if (input.description !== undefined) {
    project.description = normalizeString(input.description);
  }

  if (input.ownerId !== undefined) {
    project.ownerId = input.ownerId;
  }

  if (input.participantDepartmentIds !== undefined) {
    project.participantDepartmentIds = Array.from(new Set(input.participantDepartmentIds));
  }

  if (input.plannedStartDate !== undefined) {
    project.plannedStartDate = input.plannedStartDate || undefined;
  }

  if (input.plannedEndDate !== undefined) {
    project.plannedEndDate = input.plannedEndDate || undefined;
  }

  if (input.plannedReleaseDate !== undefined) {
    project.plannedReleaseDate = input.plannedReleaseDate || undefined;
  }

  project.updatedAt = new Date().toISOString();
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "project.update",
    targetType: "Project",
    targetId: project.id,
    summary: `编辑项目 ${project.code}`,
    traceId
  });

  return toProjectView(project, currentUser);
}

function transitionProject(
  project: Project,
  targetStatus: ProjectStatus,
  currentUser: StoredUser,
  traceId: string,
  reason: string
) {
  if (!canManageProject(currentUser, project)) {
    throw forbidden("没有权限更新该项目状态");
  }

  if (!projectStatusTransitions[project.status].includes(targetStatus)) {
    throw badRequest("项目状态不允许这样流转");
  }

  const now = new Date().toISOString();
  const fromStatus = project.status;
  project.status = targetStatus;
  project.updatedAt = now;
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "project.status.update",
    targetType: "Project",
    targetId: project.id,
    summary: `项目状态 ${fromStatus} -> ${targetStatus}：${reason}`,
    traceId
  });

  return project;
}

function notifyProjectParticipants(project: Project, title: string, content: string) {
  const participantUserIds = getStore()
    .users.filter(
      (user) =>
        user.status === "active" &&
        (project.participantDepartmentIds.includes(user.departmentId) || user.id === project.ownerId)
    )
    .map((user) => user.id);

  createNotifications(
    participantUserIds.map((userId) => ({
      userId,
      title,
      content,
      type: "approval",
      entityType: "project",
      entityId: project.id
    }))
  );
}

export function startProject(projectId: string, currentUser: StoredUser, traceId: string) {
  const project = transitionProject(
    requireProject(projectId),
    "IN_PROGRESS",
    currentUser,
    traceId,
    "启动项目"
  );
  const requirement = requireRequirement(project.requirementId);

  if (["SCHEDULED", "APPROVED"].includes(requirement.status)) {
    const fromStatus = requirement.status;
    requirement.status = "IN_DEVELOPMENT";
    requirement.updatedAt = new Date().toISOString();
    appendStatusHistory(requirement, fromStatus, requirement.status, currentUser.id, "项目启动");
  }

  notifyProjectParticipants(project, "项目已启动", `${project.name} 已进入执行阶段。`);
  return toProjectView(project, currentUser);
}

export function completeProject(projectId: string, currentUser: StoredUser, traceId: string) {
  const project = transitionProject(
    requireProject(projectId),
    "DONE",
    currentUser,
    traceId,
    "完成项目"
  );
  notifyProjectParticipants(project, "项目已完成", `${project.name} 已标记完成。`);
  return toProjectView(project, currentUser);
}

function assertTaskInput(input: TaskCreateInput | TaskUpdateInput) {
  if (input.assigneeId) {
    assertActiveUser(input.assigneeId, "任务负责人不存在或已停用");
  }

  if (input.departmentId) {
    assertDepartments([input.departmentId]);
  }
}

function assertDependencyIds(projectId: string, dependencyTaskIds: string[], selfTaskId?: string) {
  const duplicateIds = dependencyTaskIds.filter(
    (taskId, index) => dependencyTaskIds.indexOf(taskId) !== index
  );

  if (duplicateIds.length > 0) {
    throw badRequest("依赖任务不能重复");
  }

  if (selfTaskId && dependencyTaskIds.includes(selfTaskId)) {
    throw badRequest("任务不能依赖自身");
  }

  const invalidIds = dependencyTaskIds.filter((taskId) => {
    const task = getStore().tasks.find((item) => item.id === taskId);
    return !task || task.projectId !== projectId;
  });

  if (invalidIds.length > 0) {
    throw badRequest("依赖任务必须属于同一项目");
  }
}

function appendTaskStatusHistory(
  task: Task,
  fromStatus: TaskStatus | undefined,
  toStatus: TaskStatus,
  operatorId: string,
  reason: string
) {
  const history: TaskStatusHistory = {
    id: `task_hist_${crypto.randomUUID()}`,
    taskId: task.id,
    fromStatus,
    toStatus,
    operatorId,
    reason,
    createdAt: new Date().toISOString(),
    isSeed: true
  };

  getStore().taskStatusHistories.unshift(history);
  return history;
}

export function listProjectTasks(projectId: string, currentUser: StoredUser): ProjectTaskBoard {
  requireProject(projectId);
  const items = getStore()
    .tasks.filter((task) => task.projectId === projectId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((task) => toTaskView(task, currentUser));
  const board = TASK_STATUSES.reduce(
    (result, status) => ({
      ...result,
      [status]: items.filter((task) => task.status === status)
    }),
    {} as Record<TaskStatus, TaskView[]>
  );

  return {
    items,
    board
  };
}

export function createTask(
  projectId: string,
  input: TaskCreateInput,
  currentUser: StoredUser,
  traceId: string
) {
  const project = requireProject(projectId);

  if (!canManageProject(currentUser, project)) {
    throw forbidden("只有项目负责人、产品经理、项目经理或管理员可以创建任务");
  }

  assertTaskInput(input);
  const dependencyTaskIds = Array.from(new Set(input.dependencyTaskIds ?? []));
  assertDependencyIds(project.id, dependencyTaskIds);

  const now = new Date().toISOString();
  const task: Task = {
    id: `task_${crypto.randomUUID()}`,
    code: generateTaskCode(),
    projectId: project.id,
    requirementId: project.requirementId,
    title: normalizeString(input.title),
    description: normalizeString(input.description),
    taskType: input.taskType,
    status: "TODO",
    priority: input.priority ?? "P2",
    assigneeId: input.assigneeId,
    departmentId: input.departmentId,
    startDate: input.startDate || undefined,
    dueDate: input.dueDate || undefined,
    dependencyTaskIds,
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    isSeed: true
  };

  getStore().tasks.unshift(task);
  appendTaskStatusHistory(task, undefined, "TODO", currentUser.id, "创建项目任务");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "task.create",
    targetType: "Task",
    targetId: task.id,
    summary: `创建任务 ${task.code}`,
    traceId
  });
  createNotification({
    userId: task.assigneeId,
    title: "有新的项目任务",
    content: `${project.name} 新增任务：${task.title}`,
    type: "approval",
    entityType: "task",
    entityId: task.id
  });

  return toTaskView(task, currentUser);
}

export function getTask(taskId: string, currentUser: StoredUser) {
  return toTaskView(requireTask(taskId), currentUser);
}

export function updateTask(
  taskId: string,
  input: TaskUpdateInput,
  currentUser: StoredUser,
  traceId: string
) {
  const task = requireTask(taskId);

  if (!canManageTask(currentUser, task)) {
    throw forbidden("没有权限编辑该任务");
  }

  assertTaskInput(input);

  if (input.title !== undefined) {
    task.title = normalizeString(input.title);
  }

  if (input.description !== undefined) {
    task.description = normalizeString(input.description);
  }

  if (input.taskType !== undefined) {
    task.taskType = input.taskType;
  }

  if (input.priority !== undefined) {
    task.priority = input.priority;
  }

  if (input.assigneeId !== undefined) {
    task.assigneeId = input.assigneeId;
  }

  if (input.departmentId !== undefined) {
    task.departmentId = input.departmentId;
  }

  if (input.startDate !== undefined) {
    task.startDate = input.startDate || undefined;
  }

  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate || undefined;
  }

  if (input.dependencyTaskIds !== undefined) {
    const dependencyTaskIds = Array.from(new Set(input.dependencyTaskIds));
    assertDependencyIds(task.projectId, dependencyTaskIds, task.id);
    task.dependencyTaskIds = dependencyTaskIds;
  }

  task.updatedAt = new Date().toISOString();
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "task.update",
    targetType: "Task",
    targetId: task.id,
    summary: `编辑任务 ${task.code}`,
    traceId
  });

  return toTaskView(task, currentUser);
}

export function updateTaskStatus(
  taskId: string,
  input: TaskStatusInput,
  currentUser: StoredUser,
  traceId: string
) {
  const task = requireTask(taskId);

  if (!canManageTask(currentUser, task)) {
    throw forbidden("没有权限更新该任务状态");
  }

  if (task.status === input.status) {
    return toTaskView(task, currentUser);
  }

  if (!taskStatusTransitions[task.status].includes(input.status)) {
    throw badRequest("任务状态不允许这样流转");
  }

  const reason = normalizeString(input.reason || input.blockerReason);
  if (input.status === "BLOCKED" && !normalizeString(input.blockerReason)) {
    throw badRequest("标记阻塞必须填写阻塞原因");
  }

  const fromStatus = task.status;
  task.status = input.status;
  task.updatedAt = new Date().toISOString();

  if (input.status === "BLOCKED") {
    task.blockerReason = normalizeString(input.blockerReason);
  }

  if (input.status === "IN_PROGRESS") {
    task.blockerReason = undefined;
  }

  if (input.status === "DONE") {
    task.completedAt = task.updatedAt;
    task.blockerReason = undefined;
  }

  appendTaskStatusHistory(task, fromStatus, task.status, currentUser.id, reason || "更新任务状态");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "task.status.update",
    targetType: "Task",
    targetId: task.id,
    summary: `任务状态 ${fromStatus} -> ${task.status}`,
    traceId
  });

  const project = requireProject(task.projectId);
  if (task.status === "BLOCKED") {
    createNotification({
      userId: project.ownerId,
      title: "任务被标记为阻塞",
      content: `${task.title} 阻塞原因：${task.blockerReason}`,
      type: "approval",
      entityType: "task",
      entityId: task.id
    });
  }

  if (task.status === "DONE") {
    createNotifications(
      [project.ownerId, task.createdBy].map((userId) => ({
        userId,
        title: "任务已完成",
        content: `${task.title} 已完成。`,
        type: "approval",
        entityType: "task",
        entityId: task.id
      }))
    );
  }

  return toTaskView(task, currentUser);
}

export function setTaskDependencies(
  taskId: string,
  input: TaskDependenciesInput,
  currentUser: StoredUser,
  traceId: string
) {
  const task = requireTask(taskId);

  if (!canManageTask(currentUser, task)) {
    throw forbidden("没有权限维护任务依赖");
  }

  const dependencyTaskIds = Array.from(new Set(input.dependencyTaskIds));
  assertDependencyIds(task.projectId, dependencyTaskIds, task.id);
  task.dependencyTaskIds = dependencyTaskIds;
  task.updatedAt = new Date().toISOString();
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "task.dependencies.update",
    targetType: "Task",
    targetId: task.id,
    summary: `更新任务依赖 ${task.code}`,
    traceId
  });

  return toTaskView(task, currentUser);
}

export function listMyTasks(currentUser: StoredUser) {
  return getStore()
    .tasks.filter((task) => task.assigneeId === currentUser.id)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((task) => toTaskView(task, currentUser));
}

function requirementLifecycleIndex(status: RequirementStatus) {
  return requirementLifecycleOrder.indexOf(status);
}

function isPostApprovalRequirement(requirement: Requirement) {
  return requirementLifecycleIndex(requirement.status) >= 0;
}

function getUserReviewNode(nodes: ReviewNode[], currentUser: StoredUser) {
  const currentNode = nodes.find(
    (node) => node.approverId === currentUser.id && node.status === "IN_PROGRESS"
  );
  const pendingNode = nodes.find(
    (node) => node.approverId === currentUser.id && node.status === "PENDING"
  );
  const handledNode = [...nodes]
    .reverse()
    .find(
      (node) =>
        node.approverId === currentUser.id &&
        ["APPROVED", "REJECTED", "NEEDS_SUPPLEMENT", "TRANSFERRED", "SKIPPED"].includes(node.status)
    );

  return currentNode ?? pendingNode ?? handledNode ?? null;
}

function getProjectMemberRelation(requirement: Requirement, currentUser: StoredUser) {
  return requirement.projectMembers.find((member) => member.userId === currentUser.id) ?? null;
}

function getColumnForProjectMember(
  requirement: Requirement,
  role: RequirementProjectMemberRole
): RequirementTaskBoardColumn | null {
  if (requirement.status === "ARCHIVED") {
    return "ARCHIVED";
  }

  const stage = roleStageIndex[role];
  const currentIndex = requirementLifecycleIndex(requirement.status);

  if (!stage || currentIndex < 0) {
    return null;
  }

  if (currentIndex < stage.start) {
    return "IN_PROGRESS";
  }

  if (currentIndex >= stage.done) {
    return "DELIVERED";
  }

  return "TODO";
}

function getColumnForReviewer(node: ReviewNode | null, requirement: Requirement): RequirementTaskBoardColumn | null {
  if (!node) {
    return null;
  }

  if (requirement.status === "ARCHIVED") {
    return "ARCHIVED";
  }

  if (node.status === "IN_PROGRESS") {
    return "TODO";
  }

  if (node.status === "PENDING") {
    return "IN_PROGRESS";
  }

  return "DELIVERED";
}

function summarizeBoardProject(project: Project | null): RequirementTaskBoardItem["project"] {
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    code: project.code,
    name: project.name,
    status: project.status,
    plannedReleaseDate: project.plannedReleaseDate
  };
}

function summarizeBoardNode(node: ReviewNode | null): RequirementTaskBoardItem["currentNode"] {
  if (!node) {
    return null;
  }

  return {
    id: node.id,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    status: node.status,
    dueAt: node.dueAt
  };
}

function buildRequirementBoardItem(
  requirement: Requirement,
  column: RequirementTaskBoardColumn,
  currentUser: StoredUser,
  node: ReviewNode | null,
  relationLabels: string[]
): RequirementTaskBoardItem {
  const project = getRequirementProject(requirement.id);

  const actionText =
    column === "TODO" && node?.status === "IN_PROGRESS"
      ? `待处理：${node.nodeName}`
      : column === "TODO" && requirement.ownerId === currentUser.id
        ? "需求跟进中"
        : column === "IN_PROGRESS"
          ? "尚未到你处理"
          : column === "DELIVERED"
            ? "你的环节已完成"
            : "项目已归档";

  return {
    id: requirement.id,
    column,
    requirement: {
      id: requirement.id,
      code: requirement.code,
      title: requirement.title,
      status: requirement.status,
      priority: requirement.priority,
      type: requirement.type,
      ownerId: requirement.ownerId,
      expectedReleaseDate: requirement.expectedReleaseDate,
      updatedAt: requirement.updatedAt
    },
    project: summarizeBoardProject(project),
    relationLabels: Array.from(new Set(relationLabels)),
    actionText,
    currentNode: summarizeBoardNode(node)
  };
}

function decideRequirementBoardColumn(
  requirement: Requirement,
  currentUser: StoredUser
): { column: RequirementTaskBoardColumn; node: ReviewNode | null; relationLabels: string[] } | null {
  const flow = getLatestRequirementFlow(requirement.id);
  const nodes = getFlowNodes(flow?.id);
  const userNode = getUserReviewNode(nodes, currentUser);
  const member = getProjectMemberRelation(requirement, currentUser);
  const isOwner = requirement.ownerId === currentUser.id;
  const relationLabels: string[] = [];

  if (userNode) {
    relationLabels.push("审核人");
  }

  if (member) {
    relationLabels.push(roleStageIndex[member.role]?.label ?? "项目相关人");
  }

  if (isOwner && isPostApprovalRequirement(requirement)) {
    relationLabels.push("需求跟进人");
  }

  if (relationLabels.length === 0) {
    return null;
  }

  if (requirement.status === "ARCHIVED") {
    return { column: "ARCHIVED", node: userNode, relationLabels };
  }

  const reviewerColumn = getColumnForReviewer(userNode, requirement);
  if (reviewerColumn === "TODO") {
    return { column: reviewerColumn, node: userNode, relationLabels };
  }

  if (isOwner && isPostApprovalRequirement(requirement)) {
    if (["DELIVERED", "RELEASED"].includes(requirement.status)) {
      return { column: "DELIVERED", node: userNode, relationLabels };
    }

    return { column: "TODO", node: userNode, relationLabels };
  }

  const memberColumn = member ? getColumnForProjectMember(requirement, member.role) : null;
  if (memberColumn === "TODO") {
    return { column: memberColumn, node: userNode, relationLabels };
  }

  if (reviewerColumn === "IN_PROGRESS" || memberColumn === "IN_PROGRESS") {
    return { column: "IN_PROGRESS", node: userNode, relationLabels };
  }

  if (reviewerColumn === "DELIVERED" || memberColumn === "DELIVERED") {
    return { column: "DELIVERED", node: userNode, relationLabels };
  }

  return null;
}

export function getRequirementTaskBoard(currentUser: StoredUser): RequirementTaskBoard {
  const columns: RequirementTaskBoard["columns"] = {
    TODO: [],
    IN_PROGRESS: [],
    DELIVERED: [],
    ARCHIVED: []
  };

  getStore()
    .requirements.filter((requirement) => requirement.status !== "DRAFT")
    .forEach((requirement) => {
      const decision = decideRequirementBoardColumn(requirement, currentUser);

      if (!decision) {
        return;
      }

      columns[decision.column].push(
        buildRequirementBoardItem(
          requirement,
          decision.column,
          currentUser,
          decision.node,
          decision.relationLabels
        )
      );
    });

  Object.values(columns).forEach((items) => {
    items.sort(
      (left, right) =>
        new Date(right.requirement.updatedAt).getTime() -
        new Date(left.requirement.updatedAt).getTime()
    );
  });

  return {
    columns,
    counts: {
      TODO: columns.TODO.length,
      IN_PROGRESS: columns.IN_PROGRESS.length,
      DELIVERED: columns.DELIVERED.length,
      ARCHIVED: columns.ARCHIVED.length
    }
  };
}
