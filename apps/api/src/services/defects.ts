import crypto from "node:crypto";
import type {
  BugTicket,
  BugTicketCreateInput,
  BugTicketUpdateInput,
  BugTicketView
} from "@collab/shared";
import { getStore, type StoredUser } from "../data/store";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { writeAuditLog } from "./audit";
import { toSafeUser } from "./rbac";

export type BugTicketListQuery = {
  search?: string;
  status?: string;
  severity?: string;
  priority?: string;
  requirementId?: string;
  projectId?: string;
  finderId?: string;
  handlerId?: string;
  relatedUserId?: string;
};

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

function assertActiveUser(userId: string, message: string) {
  const user = getStore().users.find((item) => item.id === userId && item.status === "active");

  if (!user) {
    throw badRequest(message);
  }

  return user;
}

function assertActiveUsers(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const missingUserIds = uniqueUserIds.filter(
    (userId) => !getStore().users.some((item) => item.id === userId && item.status === "active")
  );

  if (missingUserIds.length > 0) {
    throw badRequest(`用户不存在或已停用：${missingUserIds.join(", ")}`);
  }

  return uniqueUserIds;
}

function assertRequirementProject(requirementId: string, projectId: string) {
  const requirement = getStore().requirements.find((item) => item.id === requirementId);

  if (!requirement) {
    throw badRequest("关联需求不存在");
  }

  const project = getStore().projects.find((item) => item.id === projectId);

  if (!project) {
    throw badRequest("对应项目不存在");
  }

  if (project.requirementId !== requirementId && requirement.projectId !== projectId) {
    throw badRequest("对应项目必须属于所选需求");
  }
}

function canEditBugTicket(user: StoredUser, bugTicket: BugTicket) {
  return (
    bugTicket.finderId === user.id ||
    bugTicket.handlerId === user.id ||
    bugTicket.relatedUserIds.includes(user.id)
  );
}

function toBugTicketView(bugTicket: BugTicket, currentUser: StoredUser): BugTicketView {
  return {
    ...bugTicket,
    requirement: summarizeRequirement(bugTicket.requirementId),
    project: summarizeProject(bugTicket.projectId),
    finder: summarizeUser(bugTicket.finderId),
    handler: summarizeUser(bugTicket.handlerId),
    relatedUsers: bugTicket.relatedUserIds
      .map((userId) => summarizeUser(userId))
      .filter((user): user is NonNullable<ReturnType<typeof summarizeUser>> => Boolean(user)),
    creator: summarizeUser(bugTicket.createdBy),
    availableActions: canEditBugTicket(currentUser, bugTicket) ? ["view", "edit"] : ["view"]
  };
}

function nextBugTicketCode() {
  const maxNumber = getStore()
    .bugTickets.map((bugTicket) => /^BUG-(\d+)$/.exec(bugTicket.code)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .reduce((max, value) => Math.max(max, value), 0);

  return `BUG-${String(maxNumber + 1).padStart(4, "0")}`;
}

export function listBugTickets(query: BugTicketListQuery, currentUser: StoredUser) {
  const search = normalizeString(query.search).toLowerCase();
  const status = normalizeString(query.status);
  const severity = normalizeString(query.severity);
  const priority = normalizeString(query.priority);
  const requirementId = normalizeString(query.requirementId);
  const projectId = normalizeString(query.projectId);
  const finderId = normalizeString(query.finderId);
  const handlerId = normalizeString(query.handlerId);
  const relatedUserId = normalizeString(query.relatedUserId);

  return getStore()
    .bugTickets.filter((bugTicket) => {
      const matchesSearch =
        !search ||
        bugTicket.code.toLowerCase().includes(search) ||
        bugTicket.title.toLowerCase().includes(search) ||
        bugTicket.description.toLowerCase().includes(search);

      return (
        matchesSearch &&
        (!status || bugTicket.status === status) &&
        (!severity || bugTicket.severity === severity) &&
        (!priority || bugTicket.priority === priority) &&
        (!requirementId || bugTicket.requirementId === requirementId) &&
        (!projectId || bugTicket.projectId === projectId) &&
        (!finderId || bugTicket.finderId === finderId) &&
        (!handlerId || bugTicket.handlerId === handlerId) &&
        (!relatedUserId || bugTicket.relatedUserIds.includes(relatedUserId))
      );
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((bugTicket) => toBugTicketView(bugTicket, currentUser));
}

export function getBugTicket(bugTicketId: string, currentUser: StoredUser) {
  const bugTicket = getStore().bugTickets.find((item) => item.id === bugTicketId);

  if (!bugTicket) {
    throw notFound("bug单不存在");
  }

  return toBugTicketView(bugTicket, currentUser);
}

export function createBugTicket(
  input: BugTicketCreateInput,
  currentUser: StoredUser,
  traceId: string
) {
  assertRequirementProject(input.requirementId, input.projectId);
  assertActiveUser(input.finderId, "发现人不存在或已停用");
  assertActiveUser(input.handlerId, "处理人不存在或已停用");
  const relatedUserIds = assertActiveUsers(input.relatedUserIds ?? []);
  const now = new Date().toISOString();
  const bugTicket: BugTicket = {
    id: crypto.randomUUID(),
    code: nextBugTicketCode(),
    title: input.title.trim(),
    severity: input.severity,
    priority: input.priority,
    status: input.status ?? "CREATED",
    requirementId: input.requirementId,
    projectId: input.projectId,
    finderId: input.finderId,
    handlerId: input.handlerId,
    relatedUserIds,
    description: normalizeString(input.description),
    createdBy: currentUser.id,
    createdAt: now,
    updatedAt: now,
    archivedAt: input.status === "ARCHIVED" ? now : undefined,
    isSeed: true
  };

  getStore().bugTickets.unshift(bugTicket);
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "bug_ticket.create",
    targetType: "bug_ticket",
    targetId: bugTicket.id,
    summary: `创建bug单 ${bugTicket.code}`,
    traceId
  });

  return toBugTicketView(bugTicket, currentUser);
}

export function updateBugTicket(
  bugTicketId: string,
  input: BugTicketUpdateInput,
  currentUser: StoredUser,
  traceId: string
) {
  const bugTicket = getStore().bugTickets.find((item) => item.id === bugTicketId);

  if (!bugTicket) {
    throw notFound("bug单不存在");
  }

  if (!canEditBugTicket(currentUser, bugTicket)) {
    throw forbidden("只有发现人、处理人、bug关联人可以修改bug单");
  }

  const nextRequirementId = input.requirementId ?? bugTicket.requirementId;
  const nextProjectId = input.projectId ?? bugTicket.projectId;
  assertRequirementProject(nextRequirementId, nextProjectId);

  if (input.finderId !== undefined) {
    assertActiveUser(input.finderId, "发现人不存在或已停用");
    bugTicket.finderId = input.finderId;
  }

  if (input.handlerId !== undefined) {
    assertActiveUser(input.handlerId, "处理人不存在或已停用");
    bugTicket.handlerId = input.handlerId;
  }

  if (input.relatedUserIds !== undefined) {
    bugTicket.relatedUserIds = assertActiveUsers(input.relatedUserIds);
  }

  if (input.title !== undefined) {
    bugTicket.title = input.title.trim();
  }

  if (input.severity !== undefined) {
    bugTicket.severity = input.severity;
  }

  if (input.priority !== undefined) {
    bugTicket.priority = input.priority;
  }

  if (input.status !== undefined) {
    bugTicket.status = input.status;
    bugTicket.archivedAt = input.status === "ARCHIVED" ? new Date().toISOString() : undefined;
  }

  if (input.requirementId !== undefined) {
    bugTicket.requirementId = input.requirementId;
  }

  if (input.projectId !== undefined) {
    bugTicket.projectId = input.projectId;
  }

  if (input.description !== undefined) {
    bugTicket.description = normalizeString(input.description);
  }

  bugTicket.updatedAt = new Date().toISOString();
  writeAuditLog({
    actorUserId: currentUser.id,
    action: "bug_ticket.update",
    targetType: "bug_ticket",
    targetId: bugTicket.id,
    summary: `更新bug单 ${bugTicket.code}`,
    traceId
  });

  return toBugTicketView(bugTicket, currentUser);
}
