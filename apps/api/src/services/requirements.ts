import crypto from "node:crypto";
import type {
  Department,
  Requirement,
  RequirementCreateInput,
  RequirementStatus,
  RequirementStatusHistory,
  RequirementUpdateInput,
  RequirementView,
  ReviewNodeType
} from "@collab/shared";
import { getStore, type StoredUser } from "../data/store";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors";
import { writeAuditLog } from "./audit";
import { getUserRoles, isAdmin, toSafeUser } from "./rbac";

const editableStatuses: RequirementStatus[] = [
  "DRAFT",
  "WITHDRAWN",
  "NEEDS_SUPPLEMENT",
  "REJECTED"
];
const followerChangeStatuses: RequirementStatus[] = [
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
const postApprovalStatuses: RequirementStatus[] = [
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
const activeReviewFlowStatuses = new Set(["PENDING", "IN_PROGRESS"]);
const peopleChangeFields = new Set(["ownerId", "projectMembers", "reviewApproverAssignments"]);
const relatedPeopleChangeFields = new Set(["projectMembers", "reviewApproverAssignments"]);
const contentChangeFields = new Set([
  "description",
  "background",
  "goal",
  "impactScope",
  "successMetric",
  "attachments"
]);

const priorityWeight: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

const reviewApproverDepartmentByNodeType: Partial<Record<ReviewNodeType, string>> = {
  PRODUCT: "dept_product",
  TECH: "dept_platform",
  TEST: "dept_quality",
  OPERATION: "dept_business"
};

const reviewApproverLabelByNodeType: Partial<Record<ReviewNodeType, string>> = {
  PRODUCT: "产品审批",
  TECH: "技术审批",
  TEST: "测试审批",
  OPERATION: "运营/相关方确认"
};

export type RequirementListQuery = {
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  projectId?: string;
  departmentId?: string;
  ownerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: string;
};

function hasAnyRole(user: StoredUser, roleCodes: string[]) {
  const roleCodeSet = new Set(roleCodes);
  return getUserRoles(user).some((role) => roleCodeSet.has(role.code));
}

function isCoordinator(user: StoredUser) {
  return isAdmin(user) || hasAnyRole(user, ["product_manager", "project_manager"]);
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

function summarizeProject(projectId?: string) {
  if (!projectId) {
    return null;
  }

  const project = getStore().projects.find((item) => item.id === projectId);

  if (!project) {
    return null;
  }

  return {
    id: project.id,
    code: project.code,
    name: project.name,
    status: project.status
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

function isEditableStatus(status: RequirementStatus) {
  return editableStatuses.includes(status);
}

function hasActiveReviewFlow(requirement: Requirement) {
  return getStore().reviewFlows.some(
    (flow) =>
      flow.requirementId === requirement.id &&
      activeReviewFlowStatuses.has(flow.status)
  );
}

export function canEditRequirement(user: StoredUser, requirement: Requirement) {
  if (!isEditableStatus(requirement.status)) {
    return false;
  }

  if (requirement.status === "DRAFT") {
    return requirement.submitterId === user.id;
  }

  return (
    requirement.submitterId === user.id ||
    requirement.ownerId === user.id ||
    isCoordinator(user)
  );
}

export function canUpdateRequirementStatus(user: StoredUser, requirement: Requirement) {
  if (hasActiveReviewFlow(requirement) || requirement.pendingChangeReview) {
    return false;
  }

  return (
    isCoordinator(user) ||
    requirement.ownerId === user.id ||
    (isEditableStatus(requirement.status) && requirement.submitterId === user.id)
  );
}

function canChangeRequirementFollower(user: StoredUser, requirement: Requirement) {
  if (!followerChangeStatuses.includes(requirement.status)) {
    return false;
  }

  return requirement.ownerId === user.id || isCoordinator(user);
}

function getRequirementApproverIds(requirement: Requirement) {
  const assignmentIds = Object.values(requirement.reviewApproverAssignments ?? {}).filter(
    (userId): userId is string => Boolean(userId)
  );
  const nodeApproverIds = getStore()
    .reviewFlows.filter((flow) => flow.requirementId === requirement.id)
    .flatMap((flow) =>
      getStore()
        .reviewNodes.filter((node) => node.flowId === flow.id)
        .map((node) => node.approverId)
    );

  return Array.from(new Set([...assignmentIds, ...nodeApproverIds]));
}

function getRequirementMemberIds(requirement: Requirement) {
  return Array.from(
    new Set(
      requirement.projectMembers
        .map((member) => member.userId)
        .filter((userId): userId is string => Boolean(userId))
    )
  );
}

function isRequirementRelatedUser(user: StoredUser, requirement: Requirement) {
  return (
    requirement.submitterId === user.id ||
    requirement.ownerId === user.id ||
    getRequirementMemberIds(requirement).includes(user.id)
  );
}

export function canEditRequirementPeople(user: StoredUser, requirement: Requirement) {
  return (
    postApprovalStatuses.includes(requirement.status) &&
    (isAdmin(user) ||
      isRequirementRelatedUser(user, requirement) ||
      getRequirementApproverIds(requirement).includes(user.id))
  );
}

export function canStartRequirementChangeReview(user: StoredUser, requirement: Requirement) {
  return (
    (postApprovalStatuses.includes(requirement.status) || Boolean(requirement.pendingChangeReview)) &&
    (isAdmin(user) || isRequirementRelatedUser(user, requirement))
  );
}

export function canSubmitRequirement(user: StoredUser, requirement: Requirement) {
  if (requirement.pendingChangeReview) {
    return canStartRequirementChangeReview(user, requirement);
  }

  if (requirement.status === "DRAFT") {
    return requirement.submitterId === user.id;
  }

  return (
    requirement.submitterId === user.id ||
    requirement.ownerId === user.id ||
    isCoordinator(user)
  );
}

export function canWithdrawRequirement(user: StoredUser, requirement: Requirement) {
  return requirement.status === "PENDING_REVIEW" && canSubmitRequirement(user, requirement);
}

export function toRequirementView(requirement: Requirement, currentUser: StoredUser): RequirementView {
  const availableActions: RequirementView["availableActions"] = ["view"];
  const activeReviewFlow = getStore().reviewFlows.some(
    (flow) =>
      flow.requirementId === requirement.id &&
      (flow.status === "PENDING" || flow.status === "IN_PROGRESS")
  );

  if (canEditRequirement(currentUser, requirement)) {
    availableActions.push("edit");
  }

  if (canChangeRequirementFollower(currentUser, requirement)) {
    availableActions.push("edit", "editFollower", "editPeople");
  }

  if (canEditRequirementPeople(currentUser, requirement)) {
    availableActions.push("edit", "editPeople");
  }

  if (canStartRequirementChangeReview(currentUser, requirement)) {
    availableActions.push("edit", "editCoreChange");
  }

  if (canUpdateRequirementStatus(currentUser, requirement)) {
    availableActions.push("updateStatus");
  }

  if (
    (["DRAFT", "PENDING_REVIEW", "NEEDS_SUPPLEMENT", "REJECTED"].includes(requirement.status) ||
      Boolean(requirement.pendingChangeReview)) &&
    !activeReviewFlow &&
    canSubmitRequirement(currentUser, requirement)
  ) {
    availableActions.push("submitReview", "startReview");

    if (requirement.pendingChangeReview) {
      availableActions.push("submitChangeReview");
    }
  }

  if (canWithdrawRequirement(currentUser, requirement)) {
    availableActions.push("withdraw");
  }

  return {
    ...requirement,
    submitter: summarizeUser(requirement.submitterId)!,
    owner: summarizeUser(requirement.ownerId),
    department: summarizeDepartment(requirement.departmentId),
    project: summarizeProject(requirement.projectId),
    relatedDepartmentInfos: requirement.relatedDepartments
      .map((departmentId) => summarizeDepartment(departmentId))
      .filter((department): department is Pick<Department, "id" | "name" | "code"> =>
        Boolean(department)
      ),
    availableActions: Array.from(new Set(availableActions))
  };
}

export function listRequirements(query: RequirementListQuery, currentUser: StoredUser) {
  const store = getStore();
  const keyword = String(query.search ?? "").trim().toLowerCase();
  const statusFilter = parseListFilter(query.status);
  const priorityFilter = parseListFilter(query.priority);
  const typeFilter = parseListFilter(query.type);
  const projectId = String(query.projectId ?? "").trim();
  const departmentId = String(query.departmentId ?? "").trim();
  const ownerId = String(query.ownerId ?? "").trim();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  const sortBy = String(query.sortBy ?? "createdAt");
  const sortOrder = String(query.sortOrder ?? "desc") === "asc" ? "asc" : "desc";
  const explicitlyFilteringDrafts = statusFilter.has("DRAFT");

  return store.requirements
    .filter((requirement) => canViewRequirement(currentUser, requirement))
    .filter(
      (requirement) => requirement.status !== "DRAFT" || explicitlyFilteringDrafts
    )
    .filter((requirement) => {
      if (!keyword) {
        return true;
      }

      const submitter = summarizeUser(requirement.submitterId);
      const owner = summarizeUser(requirement.ownerId);
      return [
        requirement.title,
        requirement.code,
        submitter?.displayName,
        submitter?.username,
        owner?.displayName,
        owner?.username
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    })
    .filter((requirement) => statusFilter.size === 0 || statusFilter.has(requirement.status))
    .filter(
      (requirement) =>
        priorityFilter.size === 0 || (requirement.priority && priorityFilter.has(requirement.priority))
    )
    .filter(
      (requirement) => typeFilter.size === 0 || (requirement.type && typeFilter.has(requirement.type))
    )
    .filter((requirement) => !projectId || requirement.projectId === projectId)
    .filter((requirement) => !departmentId || requirement.departmentId === departmentId)
    .filter((requirement) => !ownerId || requirement.ownerId === ownerId)
    .filter((requirement) => {
      const createdAt = new Date(requirement.createdAt);

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
    .sort((left, right) => {
      const direction = sortOrder === "asc" ? 1 : -1;

      if (sortBy === "priority") {
        const leftWeight = priorityWeight[left.priority ?? "P3"] ?? 99;
        const rightWeight = priorityWeight[right.priority ?? "P3"] ?? 99;
        return (leftWeight - rightWeight) * direction;
      }

      if (sortBy === "expectedReleaseDate") {
        const leftTime = left.expectedReleaseDate ? new Date(left.expectedReleaseDate).getTime() : 0;
        const rightTime = right.expectedReleaseDate ? new Date(right.expectedReleaseDate).getTime() : 0;
        return (leftTime - rightTime) * direction;
      }

      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    })
    .map((requirement) => toRequirementView(requirement, currentUser));
}

export function canViewRequirement(user: StoredUser, requirement: Requirement) {
  if (requirement.status !== "DRAFT") {
    return true;
  }

  return requirement.submitterId === user.id;
}

export function assertCanViewRequirement(user: StoredUser, requirement: Requirement) {
  if (!canViewRequirement(user, requirement)) {
    throw forbidden("草稿需求仅创建人可见");
  }
}

export function requireRequirement(requirementId: string) {
  const requirement = getStore().requirements.find((item) => item.id === requirementId);

  if (!requirement) {
    throw notFound("需求不存在");
  }

  return requirement;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isFollowerOnlyUpdate(input: RequirementUpdateInput) {
  const keys = Object.keys(input);
  return keys.length > 0 && keys.every((key) => key === "ownerId");
}

function isAllowedPostApprovalChange(input: RequirementUpdateInput) {
  const keys = Object.keys(input);
  return (
    keys.length > 0 &&
    keys.every((key) => peopleChangeFields.has(key) || contentChangeFields.has(key))
  );
}

function stripStatus(input: RequirementUpdateInput): RequirementUpdateInput {
  const { status: _status, ...rest } = input;
  return rest;
}

function assertCanTransitionRequirementStatus(
  requirement: Requirement,
  targetStatus: RequirementStatus,
  currentUser: StoredUser
) {
  if (!canUpdateRequirementStatus(currentUser, requirement)) {
    throw forbidden("没有权限变更需求状态");
  }

  if (targetStatus === requirement.status) {
    return;
  }
}

function applyRequirementStatusUpdate(
  requirement: Requirement,
  targetStatus: RequirementStatus | undefined,
  currentUser: StoredUser
) {
  if (!targetStatus || targetStatus === requirement.status) {
    return false;
  }

  const fromStatus = requirement.status;
  requirement.status = targetStatus;
  appendStatusHistory(requirement, fromStatus, targetStatus, currentUser.id, "手动更新需求状态");
  return true;
}

function areAttachmentsEqual(
  left: Requirement["attachments"] | undefined,
  right: Requirement["attachments"] | undefined
) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function getChangedContentFields(requirement: Requirement, input: RequirementUpdateInput) {
  const changedFields: string[] = [];

  if (input.description !== undefined && normalizeString(input.description) !== requirement.description) {
    changedFields.push("description");
  }

  if (input.background !== undefined && normalizeString(input.background) !== requirement.background) {
    changedFields.push("background");
  }

  if (input.goal !== undefined && normalizeString(input.goal) !== requirement.goal) {
    changedFields.push("goal");
  }

  if (input.impactScope !== undefined && normalizeString(input.impactScope) !== requirement.impactScope) {
    changedFields.push("impactScope");
  }

  if (
    input.successMetric !== undefined &&
    (input.successMetric.trim() || undefined) !== requirement.successMetric
  ) {
    changedFields.push("successMetric");
  }

  if (input.attachments !== undefined && !areAttachmentsEqual(input.attachments, requirement.attachments)) {
    changedFields.push("attachments");
  }

  return changedFields;
}

function inferChangeReviewNodeTypes(requirement: Requirement) {
  const nodeTypes = new Set<ReviewNodeType>();
  const departmentCodes = requirement.relatedDepartments
    .map((departmentId) => getStore().departments.find((department) => department.id === departmentId)?.code)
    .filter(Boolean);
  const projectMemberRoles = requirement.projectMembers.map((member) => member.role);

  if (
    departmentCodes.includes("platform") ||
    projectMemberRoles.some((role) => role === "FRONTEND" || role === "BACKEND") ||
    requirement.type === "BUGFIX"
  ) {
    nodeTypes.add("TECH");
  }

  if (departmentCodes.includes("quality") || projectMemberRoles.includes("TEST")) {
    nodeTypes.add("TEST");
  }

  if (departmentCodes.includes("design") || projectMemberRoles.includes("UI_DESIGN")) {
    nodeTypes.add("DESIGN");
  }

  if (departmentCodes.includes("business") || requirement.source === "OPERATION" || requirement.type === "ACTIVITY") {
    nodeTypes.add("OPERATION");
  }

  if (requirement.type === "DATA") {
    nodeTypes.add("DATA");
  }

  if (requirement.type === "COMPLIANCE" || departmentCodes.includes("review")) {
    nodeTypes.add("DATA");
  }

  if (nodeTypes.size === 0) {
    nodeTypes.add("PRODUCT");
  }

  return Array.from(nodeTypes);
}

function assertReferenceIds(input: RequirementCreateInput | RequirementUpdateInput) {
  const store = getStore();

  if (input.projectId && !store.projects.some((item) => item.id === input.projectId)) {
    throw badRequest("所属项目不存在");
  }

  if (input.departmentId && !store.departments.some((item) => item.id === input.departmentId)) {
    throw badRequest("提出部门不存在");
  }

  if (input.ownerId) {
    const owner = store.users.find((item) => item.id === input.ownerId && item.status === "active");

    if (!owner) {
      throw badRequest("需求跟进人不存在或已停用");
    }
  }

  Object.values(input.reviewApproverAssignments ?? {}).forEach((userId) => {
    if (!userId) {
      return;
    }

    const user = store.users.find((item) => item.id === userId && item.status === "active");

    if (!user) {
      throw badRequest("审批人不存在或已停用");
    }
  });

  Object.entries(input.reviewApproverAssignments ?? {}).forEach(([nodeType, userId]) => {
    const departmentId = reviewApproverDepartmentByNodeType[nodeType as ReviewNodeType];
    if (!userId || !departmentId) {
      return;
    }

    const department = store.departments.find((item) => item.id === departmentId);
    if (!department) {
      throw badRequest("审批节点对应职能不存在");
    }

    if (!department.leaderUserIds.includes(userId)) {
      throw badRequest(
        `${reviewApproverLabelByNodeType[nodeType as ReviewNodeType] ?? "审批"}人必须是${department.name}负责人`
      );
    }
  });

  (input.projectMembers ?? []).forEach((member) => {
    const user = store.users.find((item) => item.id === member.userId && item.status === "active");

    if (!user) {
      throw badRequest("项目相关人不存在或已停用");
    }
  });

  const missingDepartmentIds = (input.relatedDepartments ?? []).filter(
    (departmentId) => !store.departments.some((item) => item.id === departmentId)
  );

  if (missingDepartmentIds.length > 0) {
    throw badRequest(`相关部门不存在：${missingDepartmentIds.join(", ")}`);
  }
}

function generateRequirementCode() {
  const maxSerial = getStore()
    .requirements.map((requirement) => /^X(\d+)$/.exec(requirement.code)?.[1])
    .map((serial) => Number(serial))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `X${maxSerial + 1}`;
}

export function createRequirement(
  input: RequirementCreateInput,
  currentUser: StoredUser,
  traceId: string
) {
  assertReferenceIds(input);

  const now = new Date().toISOString();
  const requirement: Requirement = {
    id: `req_${crypto.randomUUID()}`,
    code: generateRequirementCode(),
    title: input.title.trim(),
    description: input.description.trim(),
    background: normalizeString(input.background),
    goal: normalizeString(input.goal),
    source: input.source,
    type: input.type,
    priority: input.priority,
    status: "DRAFT",
    projectId: input.projectId || undefined,
    departmentId: input.departmentId,
    ownerId: input.ownerId,
    submitterId: currentUser.id,
    expectedReleaseDate: input.expectedReleaseDate || undefined,
    relatedDepartments: input.relatedDepartments ?? [],
    impactScope: normalizeString(input.impactScope),
    successMetric: input.successMetric?.trim() || undefined,
    attachments: input.attachments ?? [],
    reviewApproverAssignments: input.reviewApproverAssignments ?? {},
    projectMembers: input.projectMembers ?? [],
    createdAt: now,
    updatedAt: now,
    isSeed: true
  };

  getStore().requirements.unshift(requirement);
  appendStatusHistory(requirement, undefined, "DRAFT", currentUser.id, "创建需求草稿");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "requirement.create",
    targetType: "Requirement",
    targetId: requirement.id,
    summary: `创建需求草稿 ${requirement.code}`,
    traceId
  });

  return toRequirementView(requirement, currentUser);
}

function applyRequirementUpdate(requirement: Requirement, input: RequirementUpdateInput) {
  if (input.title !== undefined) {
    requirement.title = input.title.trim();
  }

  if (input.description !== undefined) {
    requirement.description = input.description.trim();
  }

  if (input.background !== undefined) {
    requirement.background = normalizeString(input.background);
  }

  if (input.goal !== undefined) {
    requirement.goal = normalizeString(input.goal);
  }

  if (input.source !== undefined) {
    requirement.source = input.source;
  }

  if (input.type !== undefined) {
    requirement.type = input.type;
  }

  if (input.priority !== undefined) {
    requirement.priority = input.priority;
  }

  if (input.projectId !== undefined) {
    requirement.projectId = input.projectId || undefined;
  }

  if (input.departmentId !== undefined) {
    requirement.departmentId = input.departmentId || undefined;
  }

  if (input.ownerId !== undefined) {
    requirement.ownerId = input.ownerId || undefined;
  }

  if (input.expectedReleaseDate !== undefined) {
    requirement.expectedReleaseDate = input.expectedReleaseDate || undefined;
  }

  if (input.relatedDepartments !== undefined) {
    requirement.relatedDepartments = input.relatedDepartments;
  }

  if (input.impactScope !== undefined) {
    requirement.impactScope = normalizeString(input.impactScope);
  }

  if (input.successMetric !== undefined) {
    requirement.successMetric = input.successMetric.trim() || undefined;
  }

  if (input.attachments !== undefined) {
    requirement.attachments = input.attachments;
  }

  if (input.reviewApproverAssignments !== undefined) {
    requirement.reviewApproverAssignments = input.reviewApproverAssignments;
  }

  if (input.projectMembers !== undefined) {
    requirement.projectMembers = input.projectMembers;
  }
}

export function updateRequirement(
  requirementId: string,
  input: RequirementUpdateInput,
  currentUser: StoredUser,
  traceId: string
) {
  const requirement = requireRequirement(requirementId);
  const targetStatus = input.status;
  const fieldInput = stripStatus(input);
  const hasFieldChanges = Object.keys(fieldInput).length > 0;
  const hasStatusChange = targetStatus !== undefined && targetStatus !== requirement.status;
  const changedContentFields = getChangedContentFields(requirement, fieldInput);

  if (targetStatus !== undefined) {
    assertCanTransitionRequirementStatus(requirement, targetStatus, currentUser);
  }

  if (hasStatusChange && changedContentFields.length > 0) {
    throw badRequest("需求内容变更需要走二次评审，不能同时手动变更状态");
  }

  if (!canEditRequirement(currentUser, requirement)) {
    if (
      hasFieldChanges &&
      postApprovalStatuses.includes(requirement.status) &&
      isAllowedPostApprovalChange(fieldInput)
    ) {
      if (changedContentFields.length > 0 && !canStartRequirementChangeReview(currentUser, requirement)) {
        throw forbidden("只有需求相关人或跟进人可以发起二次评审");
      }

      if (
        fieldInput.ownerId !== undefined &&
        !canChangeRequirementFollower(currentUser, requirement)
      ) {
        throw forbidden("没有权限变更需求跟进人");
      }

      if (
        Object.keys(fieldInput).some((key) => relatedPeopleChangeFields.has(key)) &&
        !canEditRequirementPeople(currentUser, requirement)
      ) {
        throw forbidden("没有权限变更该需求的操作人");
      }

      assertReferenceIds(fieldInput);
      applyRequirementUpdate(requirement, fieldInput);

      if (changedContentFields.length > 0) {
        const fromStatus = requirement.status;
        const nodeTypes = inferChangeReviewNodeTypes(requirement);
        requirement.pendingChangeReview = {
          returnStatus: fromStatus,
          changedFields: changedContentFields,
          nodeTypes,
          requestedBy: currentUser.id,
          requestedAt: new Date().toISOString()
        };
        requirement.status = "PENDING_REVIEW";
        appendStatusHistory(
          requirement,
          fromStatus,
          requirement.status,
          currentUser.id,
          `需求内容变更，等待二次评审：${changedContentFields.join(", ")}`
        );
      }

      const statusUpdated = applyRequirementStatusUpdate(requirement, targetStatus, currentUser);
      requirement.updatedAt = new Date().toISOString();
      writeAuditLog({
        actorUserId: currentUser.id,
        action:
          changedContentFields.length > 0
            ? "requirement.change.update"
            : statusUpdated
              ? "requirement.status.update"
              : "requirement.people.update",
        targetType: "Requirement",
        targetId: requirement.id,
        summary:
          changedContentFields.length > 0
            ? `提交需求内容变更 ${requirement.code}`
            : `变更需求相关人 ${requirement.code}`,
        traceId
      });

      return toRequirementView(requirement, currentUser);
    }

    if (!hasFieldChanges && targetStatus !== undefined) {
      applyRequirementStatusUpdate(requirement, targetStatus, currentUser);
      requirement.updatedAt = new Date().toISOString();
      writeAuditLog({
        actorUserId: currentUser.id,
        action: "requirement.status.update",
        targetType: "Requirement",
        targetId: requirement.id,
        summary: `更新需求状态 ${requirement.code}`,
        traceId
      });

      return toRequirementView(requirement, currentUser);
    }

    if (hasFieldChanges && canChangeRequirementFollower(currentUser, requirement) && isFollowerOnlyUpdate(fieldInput)) {
      assertReferenceIds(fieldInput);
      requirement.ownerId = fieldInput.ownerId || undefined;
      const statusUpdated = applyRequirementStatusUpdate(requirement, targetStatus, currentUser);
      requirement.updatedAt = new Date().toISOString();
      writeAuditLog({
        actorUserId: currentUser.id,
        action: statusUpdated ? "requirement.status.update" : "requirement.follower.update",
        targetType: "Requirement",
        targetId: requirement.id,
        summary: `变更需求跟进人 ${requirement.code}`,
        traceId
      });

      return toRequirementView(requirement, currentUser);
    }

    throw forbidden("当前状态或权限不允许编辑该需求");
  }

  assertReferenceIds(fieldInput);
  applyRequirementUpdate(requirement, fieldInput);
  const statusUpdated = applyRequirementStatusUpdate(requirement, targetStatus, currentUser);

  requirement.updatedAt = new Date().toISOString();

  writeAuditLog({
    actorUserId: currentUser.id,
    action: statusUpdated && !hasFieldChanges ? "requirement.status.update" : "requirement.update",
    targetType: "Requirement",
    targetId: requirement.id,
    summary: `编辑需求 ${requirement.code}`,
    traceId
  });

  return toRequirementView(requirement, currentUser);
}

export function validateSubmitReview(requirement: Requirement) {
  const fieldErrors: Record<string, string[]> = {};

  const addError = (field: string, message: string) => {
    fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
  };

  if (requirement.title.trim().length < 2 || requirement.title.trim().length > 100) {
    addError("title", "需求标题需为 2-100 字");
  }

  if (!requirement.description.trim()) {
    addError("description", "请填写需求描述");
  }

  if (!requirement.background.trim()) {
    addError("background", "请填写业务背景");
  }

  if (!requirement.goal.trim()) {
    addError("goal", "请填写需求目标");
  }

  if (!requirement.source) {
    addError("source", "请选择需求来源");
  }

  if (!requirement.type) {
    addError("type", "请选择需求类型");
  }

  if (!requirement.priority) {
    addError("priority", "请选择优先级");
  }

  if (!requirement.departmentId) {
    addError("departmentId", "请选择提出部门");
  }

  if (!requirement.ownerId) {
    addError("ownerId", "请选择需求跟进人");
  }

  if (requirement.relatedDepartments.length === 0) {
    addError("relatedDepartments", "请至少选择 1 个相关部门");
  }

  if (requirement.priority === "P0") {
    if (!requirement.impactScope.trim()) {
      addError("impactScope", "P0 需求必须填写影响范围");
    }

    if (!requirement.expectedReleaseDate) {
      addError("expectedReleaseDate", "P0 需求必须填写期望上线时间");
    }
  }

  if (requirement.type === "COMPLIANCE") {
    const relatedDepartments = requirement.relatedDepartments
      .map((departmentId) => getStore().departments.find((item) => item.id === departmentId))
      .filter((department): department is Department => Boolean(department));
    const hasSpecialReviewDepartment = relatedDepartments.some((department) =>
      ["review", "security", "legal", "data"].includes(department.code)
    );

    if (!hasSpecialReviewDepartment) {
      addError("relatedDepartments", "合规需求必须包含专项评审组（法务/安全/数据）");
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "提交评审校验失败", {
      fieldErrors
    });
  }
}

export function appendStatusHistory(
  requirement: Requirement,
  fromStatus: RequirementStatus | undefined,
  toStatus: RequirementStatus,
  operatorId: string,
  reason: string
) {
  const history: RequirementStatusHistory = {
    id: `hist_${crypto.randomUUID()}`,
    entityType: "requirement",
    entityId: requirement.id,
    fromStatus,
    toStatus,
    operatorId,
    reason,
    createdAt: new Date().toISOString(),
    isSeed: true
  };

  getStore().requirementStatusHistories.unshift(history);
  return history;
}

export function submitRequirementReview(
  requirementId: string,
  currentUser: StoredUser,
  traceId: string
) {
  const requirement = requireRequirement(requirementId);

  if (requirement.status !== "DRAFT") {
    throw badRequest("只有草稿状态可以提交评审");
  }

  if (!canSubmitRequirement(currentUser, requirement)) {
    throw forbidden("没有权限提交该需求评审");
  }

  validateSubmitReview(requirement);

  const fromStatus = requirement.status;
  requirement.status = "PENDING_REVIEW";
  requirement.submittedAt = new Date().toISOString();
  requirement.updatedAt = requirement.submittedAt;
  appendStatusHistory(requirement, fromStatus, requirement.status, currentUser.id, "提交评审");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "requirement.submitReview",
    targetType: "Requirement",
    targetId: requirement.id,
    summary: `提交需求评审 ${requirement.code}`,
    traceId
  });

  return toRequirementView(requirement, currentUser);
}

export function withdrawRequirement(requirementId: string, currentUser: StoredUser, traceId: string) {
  const requirement = requireRequirement(requirementId);

  if (requirement.status !== "PENDING_REVIEW") {
    throw badRequest("只有待评审状态可以撤回");
  }

  if (!canWithdrawRequirement(currentUser, requirement)) {
    throw forbidden("没有权限撤回该需求");
  }

  const fromStatus = requirement.status;
  requirement.status = "WITHDRAWN";
  requirement.withdrawnAt = new Date().toISOString();
  requirement.updatedAt = requirement.withdrawnAt;
  appendStatusHistory(requirement, fromStatus, requirement.status, currentUser.id, "撤回需求");
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "requirement.withdraw",
    targetType: "Requirement",
    targetId: requirement.id,
    summary: `撤回需求 ${requirement.code}`,
    traceId
  });

  return toRequirementView(requirement, currentUser);
}

export function getRequirementHistories(requirementId: string) {
  requireRequirement(requirementId);

  return getStore()
    .requirementStatusHistories.filter((history) => history.entityId === requirementId)
    .map((history, index) => ({ history, index }))
    .sort((left, right) => {
      const timeDiff =
        new Date(left.history.createdAt).getTime() - new Date(right.history.createdAt).getTime();

      return timeDiff || right.index - left.index;
    })
    .map((item) => item.history);
}
