import crypto from "node:crypto";
import type {
  MyReviewItem,
  Requirement,
  RequirementReviewSummary,
  ReviewFlow,
  ReviewFlowStatus,
  ReviewNode,
  ReviewNodeStatus,
  ReviewNodeType,
  ReviewNodeView,
  SubmitReviewInput,
  WorkflowTemplate,
  WorkflowTemplateNodeConfig,
  WorkflowTemplateCreateInput,
  WorkflowTemplateUpdateInput
} from "@collab/shared";
import { getStore, type StoredUser } from "../data/store";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { writeAuditLog } from "./audit";
import { createNotification, createNotifications } from "./notifications";
import {
  appendStatusHistory,
  canStartRequirementChangeReview,
  canSubmitRequirement,
  requireRequirement,
  toRequirementView,
  validateSubmitReview
} from "./requirements";
import { getUserRoles, isAdmin, toSafeUser } from "./rbac";

const activeFlowStatuses: ReviewFlowStatus[] = ["PENDING", "IN_PROGRESS"];
const actionableNodeStatuses: ReviewNodeStatus[] = ["IN_PROGRESS"];

const reviewApproverDepartmentByNodeType: Partial<Record<ReviewNodeType, string>> = {
  PRODUCT: "dept_product",
  TECH: "dept_platform",
  TEST: "dept_quality",
  DESIGN: "dept_design",
  OPERATION: "dept_business",
  LEGAL: "dept_review",
  SECURITY: "dept_review",
  DATA: "dept_review"
};

const reviewNodeFallbackConfig: Record<
  ReviewNodeType,
  {
    nodeName: string;
    defaultRoleCode?: string;
    defaultDepartmentId?: string;
  }
> = {
  PRODUCT: {
    nodeName: "产品审批",
    defaultRoleCode: "product_manager",
    defaultDepartmentId: "dept_product"
  },
  TECH: {
    nodeName: "技术审批",
    defaultRoleCode: "engineering_lead",
    defaultDepartmentId: "dept_platform"
  },
  TEST: {
    nodeName: "测试审批",
    defaultRoleCode: "tester",
    defaultDepartmentId: "dept_quality"
  },
  DESIGN: {
    nodeName: "设计审批",
    defaultRoleCode: "designer",
    defaultDepartmentId: "dept_design"
  },
  OPERATION: {
    nodeName: "运营/相关方确认",
    defaultRoleCode: "ops_support",
    defaultDepartmentId: "dept_business"
  },
  LEGAL: {
    nodeName: "法务审批",
    defaultRoleCode: "special_reviewer",
    defaultDepartmentId: "dept_review"
  },
  SECURITY: {
    nodeName: "安全审批",
    defaultRoleCode: "special_reviewer",
    defaultDepartmentId: "dept_review"
  },
  DATA: {
    nodeName: "数据审批",
    defaultRoleCode: "special_reviewer",
    defaultDepartmentId: "dept_review"
  },
  CUSTOM: {
    nodeName: "自定义审批"
  }
};

type MyReviewQuery = {
  status?: string;
  priority?: string;
  type?: string;
};

function summarizeUser(userId: string) {
  const user = getStore().users.find((item) => item.id === userId && item.status === "active");

  if (!user) {
    throw notFound("评审人不存在");
  }

  const safeUser = toSafeUser(user);
  return {
    id: safeUser.id,
    username: safeUser.username,
    displayName: safeUser.displayName,
    title: safeUser.title
  };
}

function findActiveUser(userId: string) {
  return getStore().users.find((item) => item.id === userId && item.status === "active");
}

function userHasRole(user: StoredUser, roleCode?: string) {
  if (!roleCode) {
    return false;
  }

  return getUserRoles(user).some((role) => role.code === roleCode);
}

function findUserByRole(roleCode?: string, avoidUserIds: string[] = []) {
  if (!roleCode) {
    return undefined;
  }

  return getStore().users.find(
    (user) =>
      user.status === "active" &&
      !avoidUserIds.includes(user.id) &&
      userHasRole(user, roleCode)
  );
}

function getReviewDepartmentId(nodeType: ReviewNodeType, template: WorkflowTemplate) {
  const config = template.nodesConfig.find((item) => item.nodeType === nodeType);
  return (
    config?.defaultDepartmentId ??
    reviewNodeFallbackConfig[nodeType]?.defaultDepartmentId ??
    reviewApproverDepartmentByNodeType[nodeType]
  );
}

function getDepartmentLeader(departmentId?: string, avoidUserIds: string[] = []) {
  if (!departmentId) {
    return undefined;
  }

  const department = getStore().departments.find((item) => item.id === departmentId);
  if (!department) {
    return undefined;
  }

  return department.leaderUserIds
    .map((leaderUserId) => findActiveUser(leaderUserId))
    .find((user): user is StoredUser => user !== undefined && !avoidUserIds.includes(user.id));
}

function assertDepartmentLeaderApprover(
  nodeType: ReviewNodeType,
  template: WorkflowTemplate,
  userId: string
) {
  const departmentId = getReviewDepartmentId(nodeType, template);

  if (!departmentId) {
    return;
  }

  const department = getStore().departments.find((item) => item.id === departmentId);

  if (!department) {
    throw badRequest("评审节点对应职能不存在");
  }

  if (!department.leaderUserIds.includes(userId)) {
    const config = template.nodesConfig.find((item) => item.nodeType === nodeType);
    throw badRequest(
      `${config?.nodeName ?? reviewNodeFallbackConfig[nodeType]?.nodeName ?? "评审"}审批人必须是${department.name}负责人`
    );
  }
}

function getDefaultTemplate() {
  const template = getStore().workflowTemplates.find(
    (item) => item.appliesTo === "REQUIREMENT" && item.enabled && item.isDefault
  );

  if (!template) {
    throw notFound("默认需求评审模板不存在");
  }

  return template;
}

function getTemplate(templateId?: string) {
  if (!templateId) {
    return getDefaultTemplate();
  }

  const template = getStore().workflowTemplates.find(
    (item) => item.id === templateId && item.appliesTo === "REQUIREMENT" && item.enabled
  );

  if (!template) {
    throw notFound("流程模板不存在或未启用");
  }

  return template;
}

function getLatestFlow(requirementId: string) {
  return getStore()
    .reviewFlows.filter((flow) => flow.requirementId === requirementId)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0];
}

function getFlowNodes(flowId: string) {
  return getStore()
    .reviewNodes.filter((node) => node.flowId === flowId)
    .sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id));
}

function requireFlow(flowId: string) {
  const flow = getStore().reviewFlows.find((item) => item.id === flowId);

  if (!flow) {
    throw notFound("评审流不存在");
  }

  return flow;
}

function requireNode(nodeId: string) {
  const node = getStore().reviewNodes.find((item) => item.id === nodeId);

  if (!node) {
    throw notFound("评审节点不存在");
  }

  return node;
}

function canHandleNode(currentUser: StoredUser, node: ReviewNode, requirementSubmitterId: string) {
  if (!actionableNodeStatuses.includes(node.status)) {
    return false;
  }

  if (isAdmin(currentUser)) {
    return true;
  }

  if (node.approverId !== currentUser.id) {
    return false;
  }

  return requirementSubmitterId !== currentUser.id;
}

function toNodeView(node: ReviewNode, currentUser: StoredUser): ReviewNodeView {
  const flow = requireFlow(node.flowId);
  const requirement = requireRequirement(flow.requirementId);
  const availableActions: ReviewNodeView["availableActions"] = [];

  if (canHandleNode(currentUser, node, requirement.submitterId)) {
    availableActions.push("approve", "reject", "requestSupplement", "transfer");
  }

  return {
    ...node,
    approver: summarizeUser(node.approverId),
    transferredTo: node.transferredToId ? summarizeUser(node.transferredToId) : null,
    availableActions
  };
}

function resolveApprover(
  nodeType: ReviewNodeType,
  template: WorkflowTemplate,
  requirement: Requirement,
  assignments?: SubmitReviewInput["approverAssignments"]
) {
  const config = template.nodesConfig.find((item) => item.nodeType === nodeType);
  const fallbackConfig = reviewNodeFallbackConfig[nodeType];
  const assignedUserId = assignments?.[nodeType] ?? (config?.nodeName ? assignments?.[config.nodeName] : undefined);

  if (assignedUserId) {
    const assignedUser = findActiveUser(assignedUserId);

    if (!assignedUser) {
      throw badRequest(`指定评审人不存在或已停用：${assignedUserId}`);
    }

    if (assignedUser.id === requirement.submitterId) {
      throw badRequest("需求提交人不能作为自己的评审审批人");
    }

    assertDepartmentLeaderApprover(nodeType, template, assignedUser.id);
    return assignedUser.id;
  }

  const defaultUser =
    config?.defaultApproverUserId && findActiveUser(config.defaultApproverUserId)?.id !== requirement.submitterId
      ? findActiveUser(config.defaultApproverUserId)
      : undefined;

  if (defaultUser) {
    assertDepartmentLeaderApprover(nodeType, template, defaultUser.id);
    return defaultUser.id;
  }

  const departmentLeader = getDepartmentLeader(getReviewDepartmentId(nodeType, template), [
    requirement.submitterId
  ]);

  if (departmentLeader) {
    return departmentLeader.id;
  }

  const roleUser = findUserByRole(config?.defaultRoleCode ?? fallbackConfig?.defaultRoleCode, [
    requirement.submitterId
  ]);

  if (roleUser) {
    assertDepartmentLeaderApprover(nodeType, template, roleUser.id);
    return roleUser.id;
  }

  const fallbackUser = getStore().users.find(
    (user) => user.status === "active" && user.id !== requirement.submitterId
  );

  if (!fallbackUser) {
    throw badRequest("没有可用评审人");
  }

  assertDepartmentLeaderApprover(nodeType, template, fallbackUser.id);
  return fallbackUser.id;
}

function createNodesFromTemplate(
  flow: ReviewFlow,
  template: WorkflowTemplate,
  requirement: Requirement,
  assignments?: SubmitReviewInput["approverAssignments"],
  nodeTypes?: ReviewNodeType[]
) {
  const nodeTypeSet = nodeTypes?.length ? new Set(nodeTypes) : null;
  const templateConfigs = [...template.nodesConfig]
    .filter((config) => !nodeTypeSet || nodeTypeSet.has(config.nodeType))
    .sort((left, right) => left.orderIndex - right.orderIndex);
  const missingConfigs = nodeTypes
    ?.filter((nodeType) => !templateConfigs.some((config) => config.nodeType === nodeType))
    .map((nodeType, index): WorkflowTemplateNodeConfig => {
      const fallbackConfig = reviewNodeFallbackConfig[nodeType];

      return {
        nodeName: fallbackConfig?.nodeName ?? "二次评审",
        nodeType,
        defaultRoleCode: fallbackConfig?.defaultRoleCode,
        defaultDepartmentId: fallbackConfig?.defaultDepartmentId,
        required: true,
        orderIndex: templateConfigs.length + index,
        dueInHours: 24
      };
    }) ?? [];
  const sortedConfigs = [...templateConfigs, ...missingConfigs].sort(
    (left, right) => left.orderIndex - right.orderIndex
  );
  const now = new Date(flow.startedAt).getTime();

  return sortedConfigs.map((config, index): ReviewNode => {
    const dueInHours = config.dueInHours ?? 24;

    return {
      id: `node_${crypto.randomUUID()}`,
      flowId: flow.id,
      nodeName: config.nodeName,
      nodeType: config.nodeType,
      approverId: resolveApprover(config.nodeType, template, requirement, assignments),
      status: index === 0 ? "IN_PROGRESS" : "PENDING",
      orderIndex: config.orderIndex,
      dueAt: new Date(now + dueInHours * 60 * 60 * 1000).toISOString(),
      required: config.required,
      isSeed: true
    };
  });
}

function notifyNode(
  node: ReviewNode,
  requirementCode: string,
  requirementTitle: string,
  requirementId: string
) {
  createNotification({
    userId: node.approverId,
    title: "有新的需求评审待处理",
    content: `${requirementCode} ${requirementTitle} 已进入「${node.nodeName}」节点，请及时处理。`,
    type: "approval",
    entityType: "requirement",
    entityId: requirementId
  });
}

function notifyRequirementActors(requirementId: string, title: string, content: string) {
  const requirement = requireRequirement(requirementId);
  const userIds = [requirement.submitterId, requirement.ownerId].filter(
    (userId): userId is string => Boolean(userId)
  );

  createNotifications(
    Array.from(new Set(userIds)).map((userId) => ({
      userId,
      title,
      content,
      type: "approval",
      entityType: "requirement",
      entityId: requirement.id
    }))
  );
}

function notifyProjectManagers(requirementId: string, title: string, content: string) {
  const projectManagers = getStore().users.filter(
    (user) => user.status === "active" && userHasRole(user, "project_manager")
  );

  createNotifications(
    projectManagers.map((user) => ({
      userId: user.id,
      title,
      content,
      type: "approval",
      entityType: "requirement",
      entityId: requirementId
    }))
  );
}

function markRestSkipped(flowId: string, exceptNodeId: string) {
  getFlowNodes(flowId).forEach((node) => {
    if (node.id !== exceptNodeId && ["PENDING", "IN_PROGRESS"].includes(node.status)) {
      node.status = "SKIPPED";
      node.handledAt = new Date().toISOString();
    }
  });
}

function completeFlow(
  flow: ReviewFlow,
  status: Extract<ReviewFlowStatus, "APPROVED" | "REJECTED" | "NEEDS_SUPPLEMENT">,
  operatorId: string,
  reason: string
) {
  const requirement = requireRequirement(flow.requirementId);
  const fromStatus = requirement.status;
  flow.status = status;
  flow.completedAt = new Date().toISOString();
  requirement.status =
    status === "APPROVED" && flow.reviewKind === "CHANGE" && flow.returnStatus
      ? flow.returnStatus
      : status === "NEEDS_SUPPLEMENT"
        ? "NEEDS_SUPPLEMENT"
        : status;
  if (status === "APPROVED") {
    requirement.pendingChangeReview = undefined;
  }
  requirement.updatedAt = flow.completedAt;
  appendStatusHistory(requirement, fromStatus, requirement.status, operatorId, reason);
}

function maybeApproveFlow(flow: ReviewFlow, operatorId: string) {
  const nodes = getFlowNodes(flow.id).filter((node) => node.required && node.status !== "TRANSFERRED");
  const allRequiredApproved = nodes.every(
    (node) => node.status === "APPROVED" || node.status === "SKIPPED"
  );

  if (!allRequiredApproved) {
    return false;
  }

  completeFlow(flow, "APPROVED", operatorId, "所有评审节点已通过");
  const requirement = requireRequirement(flow.requirementId);
  notifyRequirementActors(
    requirement.id,
    "需求评审已通过",
    `${requirement.code} ${requirement.title} 已通过全部评审节点。`
  );
  notifyProjectManagers(
    requirement.id,
    "需求评审已通过",
    `${requirement.code} ${requirement.title} 已通过评审，可准备进入项目立项。`
  );

  return true;
}

export function startRequirementReview(
  requirementId: string,
  currentUser: StoredUser,
  traceId: string,
  input: SubmitReviewInput = {}
) {
  const requirement = requireRequirement(requirementId);
  const pendingChangeReview = requirement.pendingChangeReview;
  const isChangeReview = input.reviewKind === "CHANGE" || Boolean(pendingChangeReview);
  const allowedStatuses = ["DRAFT", "PENDING_REVIEW", "NEEDS_SUPPLEMENT", "REJECTED"];

  if (!allowedStatuses.includes(requirement.status) && !isChangeReview) {
    throw badRequest("当前需求状态不能发起评审");
  }

  if (isChangeReview && !canStartRequirementChangeReview(currentUser, requirement)) {
    throw forbidden("只有需求相关人或跟进人可以发起二次评审");
  }

  if (!isChangeReview && !canSubmitRequirement(currentUser, requirement)) {
    throw forbidden("没有权限发起该需求评审");
  }

  validateSubmitReview(requirement);

  const activeFlow = getStore().reviewFlows.find(
    (flow) => flow.requirementId === requirement.id && activeFlowStatuses.includes(flow.status)
  );

  if (activeFlow) {
    throw conflict("该需求已有进行中的评审流");
  }

  const template = getTemplate(input.templateId);
  const now = new Date().toISOString();
  const fromStatus = requirement.status;
  const returnStatus = pendingChangeReview?.returnStatus ?? requirement.status;
  const changeNodeTypes = input.nodeTypes?.length
    ? input.nodeTypes
    : pendingChangeReview?.nodeTypes;
  const approverAssignments = {
    ...(requirement.reviewApproverAssignments ?? {}),
    ...(input.approverAssignments ?? {})
  };

  if (isChangeReview && (!changeNodeTypes || changeNodeTypes.length === 0)) {
    throw badRequest("二次评审至少需要一个审批节点");
  }

  if (requirement.status !== "PENDING_REVIEW") {
    requirement.status = "PENDING_REVIEW";
    requirement.submittedAt = now;
    requirement.updatedAt = now;
    appendStatusHistory(requirement, fromStatus, "PENDING_REVIEW", currentUser.id, "提交评审");
  }

  const flow: ReviewFlow = {
    id: `flow_${crypto.randomUUID()}`,
    requirementId: requirement.id,
    templateId: template.id,
    reviewKind: isChangeReview ? "CHANGE" : "INITIAL",
    returnStatus: isChangeReview ? returnStatus : undefined,
    status: "IN_PROGRESS",
    startedBy: currentUser.id,
    startedAt: now,
    isSeed: true
  };
  const nodes = createNodesFromTemplate(
    flow,
    template,
    requirement,
    approverAssignments,
    isChangeReview ? changeNodeTypes : undefined
  );

  getStore().reviewFlows.unshift(flow);
  getStore().reviewNodes.push(...nodes);
  requirement.status = "IN_REVIEW";
  requirement.updatedAt = now;
  appendStatusHistory(
    requirement,
    "PENDING_REVIEW",
    "IN_REVIEW",
    currentUser.id,
    isChangeReview ? "创建需求二次评审流程" : "创建评审流程"
  );

  const firstNode = nodes.find((node) => node.status === "IN_PROGRESS");
  if (firstNode) {
    notifyNode(firstNode, requirement.code, requirement.title, requirement.id);
  }

  writeAuditLog({
    actorUserId: currentUser.id,
    action: "review.start",
    targetType: "Requirement",
    targetId: requirement.id,
    summary: `${isChangeReview ? "发起需求二次评审" : "发起需求评审"} ${requirement.code}`,
    traceId
  });

  return toRequirementView(requirement, currentUser);
}

export function getRequirementReviews(
  requirementId: string,
  currentUser: StoredUser
): RequirementReviewSummary {
  requireRequirement(requirementId);
  const flow = getLatestFlow(requirementId);

  if (!flow) {
    return {
      flow: null,
      nodes: []
    };
  }

  const template = flow.templateId
    ? getStore().workflowTemplates.find((item) => item.id === flow.templateId)
    : null;

  return {
    flow: {
      ...flow,
      template: template
        ? {
            id: template.id,
            name: template.name,
            description: template.description
          }
        : null
    },
    nodes: getFlowNodes(flow.id).map((node) => toNodeView(node, currentUser))
  };
}

export function listMyReviews(query: MyReviewQuery, currentUser: StoredUser): MyReviewItem[] {
  const status = String(query.status ?? "pending");
  const priority = String(query.priority ?? "").trim();
  const type = String(query.type ?? "").trim();
  const now = Date.now();

  return getStore()
    .reviewNodes.filter((node) => node.approverId === currentUser.id)
    .filter((node) => {
      if (status === "handled") {
        return node.status !== "IN_PROGRESS" && node.status !== "PENDING";
      }

      if (status === "overdue") {
        return node.status === "IN_PROGRESS" && Boolean(node.dueAt) && new Date(node.dueAt!).getTime() < now;
      }

      return node.status === "IN_PROGRESS";
    })
    .map((node) => {
      const flow = requireFlow(node.flowId);
      const requirement = requireRequirement(flow.requirementId);
      return {
        flow,
        node: toNodeView(node, currentUser),
        requirement: toRequirementView(requirement, currentUser)
      };
    })
    .filter((item) => !priority || item.requirement.priority === priority)
    .filter((item) => !type || item.requirement.type === type)
    .sort(
      (left, right) =>
        new Date(left.node.dueAt ?? left.flow.startedAt).getTime() -
        new Date(right.node.dueAt ?? right.flow.startedAt).getTime()
    );
}

function assertNodeCanBeHandled(node: ReviewNode, currentUser: StoredUser) {
  const flow = requireFlow(node.flowId);
  const requirement = requireRequirement(flow.requirementId);

  if (flow.status !== "IN_PROGRESS") {
    throw badRequest("评审流不在处理中");
  }

  if (!canHandleNode(currentUser, node, requirement.submitterId)) {
    throw forbidden("没有权限处理该评审节点");
  }

  return { flow, requirement };
}

export function approveReviewNode(nodeId: string, currentUser: StoredUser, traceId: string, comment = "") {
  const node = requireNode(nodeId);
  const { flow, requirement } = assertNodeCanBeHandled(node, currentUser);
  const now = new Date().toISOString();
  node.status = "APPROVED";
  node.comment = comment.trim() || "同意";
  node.handledAt = now;
  node.selfApproval = node.approverId === requirement.submitterId;

  const nextNode = getFlowNodes(flow.id).find((item) => item.status === "PENDING");

  if (nextNode) {
    nextNode.status = "IN_PROGRESS";
    notifyNode(nextNode, requirement.code, requirement.title, requirement.id);
  } else {
    maybeApproveFlow(flow, currentUser.id);
  }

  writeAuditLog({
    actorUserId: currentUser.id,
    action: "review.node.approve",
    targetType: "ReviewNode",
    targetId: node.id,
    summary: `通过评审节点 ${node.nodeName}`,
    traceId
  });

  return getRequirementReviews(requirement.id, currentUser);
}

export function rejectReviewNode(nodeId: string, currentUser: StoredUser, traceId: string, comment: string) {
  if (!comment.trim()) {
    throw badRequest("驳回必须填写原因");
  }

  const node = requireNode(nodeId);
  const { flow, requirement } = assertNodeCanBeHandled(node, currentUser);
  node.status = "REJECTED";
  node.comment = comment.trim();
  node.handledAt = new Date().toISOString();
  markRestSkipped(flow.id, node.id);
  completeFlow(flow, "REJECTED", currentUser.id, `评审驳回：${node.nodeName}`);
  notifyRequirementActors(
    requirement.id,
    "需求评审已驳回",
    `${requirement.code} ${requirement.title} 在「${node.nodeName}」节点被驳回：${node.comment}`
  );
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "review.node.reject",
    targetType: "ReviewNode",
    targetId: node.id,
    summary: `驳回评审节点 ${node.nodeName}`,
    traceId
  });

  return getRequirementReviews(requirement.id, currentUser);
}

export function requestSupplementReviewNode(
  nodeId: string,
  currentUser: StoredUser,
  traceId: string,
  comment: string
) {
  if (!comment.trim()) {
    throw badRequest("要求补充必须填写原因");
  }

  const node = requireNode(nodeId);
  const { flow, requirement } = assertNodeCanBeHandled(node, currentUser);
  node.status = "NEEDS_SUPPLEMENT";
  node.comment = comment.trim();
  node.handledAt = new Date().toISOString();
  markRestSkipped(flow.id, node.id);
  completeFlow(flow, "NEEDS_SUPPLEMENT", currentUser.id, `评审要求补充：${node.nodeName}`);
  notifyRequirementActors(
    requirement.id,
    "需求评审需补充",
    `${requirement.code} ${requirement.title} 在「${node.nodeName}」节点要求补充：${node.comment}`
  );
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "review.node.requestSupplement",
    targetType: "ReviewNode",
    targetId: node.id,
    summary: `要求补充评审节点 ${node.nodeName}`,
    traceId
  });

  return getRequirementReviews(requirement.id, currentUser);
}

export function transferReviewNode(
  nodeId: string,
  currentUser: StoredUser,
  traceId: string,
  targetUserId: string,
  reason: string
) {
  if (!targetUserId) {
    throw badRequest("请选择转派目标评审人");
  }

  if (!reason.trim()) {
    throw badRequest("转派必须填写原因");
  }

  const targetUser = findActiveUser(targetUserId);

  if (!targetUser) {
    throw badRequest("转派目标评审人不存在或已停用");
  }

  const node = requireNode(nodeId);
  const { requirement } = assertNodeCanBeHandled(node, currentUser);

  if (targetUser.id === node.approverId) {
    throw badRequest("不能转派给当前评审人");
  }

  node.status = "TRANSFERRED";
  node.comment = reason.trim();
  node.transferredToId = targetUser.id;
  node.handledAt = new Date().toISOString();

  const transferNode: ReviewNode = {
    ...node,
    id: `node_${crypto.randomUUID()}`,
    approverId: targetUser.id,
    status: "IN_PROGRESS",
    comment: `由 ${summarizeUser(currentUser.id).displayName} 转派：${reason.trim()}`,
    orderIndex: node.orderIndex + 0.1,
    handledAt: undefined,
    transferredToId: undefined,
    selfApproval: false
  };
  getStore().reviewNodes.push(transferNode);
  notifyNode(transferNode, requirement.code, requirement.title, requirement.id);
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "review.node.transfer",
    targetType: "ReviewNode",
    targetId: node.id,
    summary: `转派评审节点 ${node.nodeName}`,
    traceId
  });

  return getRequirementReviews(requirement.id, currentUser);
}

export function listWorkflowTemplates(appliesTo?: string) {
  return getStore().workflowTemplates.filter(
    (template) => !appliesTo || template.appliesTo === appliesTo
  );
}

export function createWorkflowTemplate(input: WorkflowTemplateCreateInput, currentUser: StoredUser) {
  if (!isAdmin(currentUser)) {
    throw forbidden("只有系统管理员可以创建流程模板");
  }

  const now = new Date().toISOString();
  const template: WorkflowTemplate = {
    id: `template_${crypto.randomUUID()}`,
    name: input.name.trim(),
    description: input.description.trim(),
    appliesTo: input.appliesTo,
    isDefault: Boolean(input.isDefault),
    enabled: input.enabled ?? true,
    nodesConfig: input.nodesConfig,
    createdAt: now,
    updatedAt: now,
    isSeed: true
  };

  if (template.isDefault) {
    getStore().workflowTemplates.forEach((item) => {
      if (item.appliesTo === template.appliesTo) {
        item.isDefault = false;
      }
    });
  }

  getStore().workflowTemplates.unshift(template);
  return template;
}

export function updateWorkflowTemplate(
  templateId: string,
  input: WorkflowTemplateUpdateInput,
  currentUser: StoredUser
) {
  if (!isAdmin(currentUser)) {
    throw forbidden("只有系统管理员可以编辑流程模板");
  }

  const template = getStore().workflowTemplates.find((item) => item.id === templateId);

  if (!template) {
    throw notFound("流程模板不存在");
  }

  if (input.name !== undefined) {
    template.name = input.name.trim();
  }

  if (input.description !== undefined) {
    template.description = input.description.trim();
  }

  if (input.enabled !== undefined) {
    template.enabled = input.enabled;
  }

  if (input.nodesConfig !== undefined) {
    template.nodesConfig = input.nodesConfig;
  }

  if (input.isDefault !== undefined) {
    template.isDefault = input.isDefault;

    if (template.isDefault) {
      getStore().workflowTemplates.forEach((item) => {
        if (item.appliesTo === template.appliesTo && item.id !== template.id) {
          item.isDefault = false;
        }
      });
    }
  }

  template.updatedAt = new Date().toISOString();
  return template;
}
