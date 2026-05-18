import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getStore, type StoredUser } from "../data/store";
import { authenticate, requirePermission } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { paginate, parsePagination } from "../lib/pagination";
import { hashPassword } from "../lib/password";
import { sendSuccess } from "../lib/response";
import { writeAuditLog } from "../services/audit";
import {
  assertCanManageDepartment,
  canManageDepartment,
  getUserRoles,
  isAdmin,
  toSafeUser
} from "../services/rbac";

export const usersRoutes = Router();

const createUserSchema = z.object({
  departmentId: z.string().min(1, "请选择职能"),
  displayName: z.string().min(1, "请输入姓名").max(32, "姓名最多 32 个字符"),
  email: z.string().email("请输入有效邮箱"),
  title: z.string().min(1, "请输入岗位").max(50, "岗位最多 50 个字符"),
  password: z.string().min(8, "密码至少 8 个字符")
});

const defaultRoleByDepartment: Record<string, string> = {
  dept_platform: "role_developer",
  dept_product: "role_product_manager",
  dept_project: "role_project_manager",
  dept_quality: "role_tester",
  dept_design: "role_designer",
  dept_business: "role_ops_support",
  dept_review: "role_special_reviewer",
  dept_management: "role_executive"
};

function hasRoleBasedUserReadPermission(user: StoredUser) {
  return getUserRoles(user).some((role) => role.permissionCodes.includes("api.users.read"));
}

function nextEmployeeNo(departmentId: string) {
  const maxEmployeeNo = getStore()
    .users.filter((user) => user.departmentId === departmentId && /^\d+$/.test(user.username))
    .map((user) => Number(user.username))
    .reduce((max, value) => Math.max(max, value), 10000);

  return String(maxEmployeeNo + 1).padStart(5, "0");
}

function canCreateUserInDepartment(user: StoredUser, departmentId: string) {
  return isAdmin(user) || user.departmentId === departmentId || canManageDepartment(user, departmentId);
}

function getUserBusinessReferences(userId: string) {
  const store = getStore();
  const references: string[] = [];

  if (
    store.requirements.some(
      (requirement) =>
        requirement.submitterId === userId ||
        requirement.ownerId === userId ||
        Object.values(requirement.reviewApproverAssignments ?? {}).includes(userId) ||
        requirement.projectMembers.some((member) => member.userId === userId)
    )
  ) {
    references.push("需求");
  }

  if (store.reviewFlows.some((flow) => flow.startedBy === userId)) {
    references.push("评审流");
  }

  if (
    store.reviewNodes.some(
      (node) => node.approverId === userId || node.transferredToId === userId
    )
  ) {
    references.push("评审节点");
  }

  if (store.requirementStatusHistories.some((history) => history.operatorId === userId)) {
    references.push("状态历史");
  }

  return references;
}

function removeNotificationsForUser(userId: string) {
  const notifications = getStore().notifications;

  for (let index = notifications.length - 1; index >= 0; index -= 1) {
    if (notifications[index].userId === userId) {
      notifications.splice(index, 1);
    }
  }
}

usersRoutes.get("/", authenticate, requirePermission("api.users.read"), (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const keyword = String(req.query.q ?? "").trim().toLowerCase();
    const requestedDepartmentId = String(req.query.departmentId ?? "").trim();
    const currentUser = req.currentUser!;
    const canReadAllUsers = isAdmin(currentUser) || hasRoleBasedUserReadPermission(currentUser);

    const users = getStore()
      .users.filter((user) => user.status === "active")
      .filter((user) => {
        if (requestedDepartmentId) {
          if (!canReadAllUsers && !canManageDepartment(currentUser, requestedDepartmentId)) {
            throw badRequest("只能查询自己负责的职能成员");
          }

          return user.departmentId === requestedDepartmentId;
        }

        if (canReadAllUsers) {
          return true;
        }

        return canManageDepartment(currentUser, user.departmentId);
      })
      .filter((user) => {
        if (!keyword) {
          return true;
        }

        return [user.username, user.displayName, user.email, user.title]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .map(toSafeUser);

    return sendSuccess(res, paginate(users, page, pageSize));
  } catch (error) {
    next(error);
  }
});

usersRoutes.post("/", authenticate, requirePermission("api.users.create"), (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);
    const store = getStore();
    const department = store.departments.find((item) => item.id === input.departmentId);

    if (!department) {
      throw badRequest("职能不存在");
    }

    if (!canCreateUserInDepartment(req.currentUser!, department.id)) {
      throw forbidden("只能在自己所属或负责的职能创建账号");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicate = store.users.find((user) => user.email.toLowerCase() === normalizedEmail);

    if (duplicate) {
      throw conflict("邮箱已存在");
    }

    const employeeNo = nextEmployeeNo(department.id);
    const roleId = defaultRoleByDepartment[department.id] ?? "role_developer";
    const { salt, hash } = hashPassword(input.password);
    const user = {
      id: `user_${crypto.randomUUID()}`,
      username: employeeNo,
      displayName: input.displayName.trim(),
      email: normalizedEmail,
      departmentId: department.id,
      roleIds: [roleId],
      status: "active" as const,
      title: input.title.trim(),
      passwordSalt: salt,
      passwordHash: hash,
      isSeed: true as const
    };

    store.users.push(user);

    writeAuditLog({
      actorUserId: req.currentUser!.id,
      action: "user.create",
      targetType: "User",
      targetId: user.id,
      summary: `创建 ${department.name} 账号 ${user.username}`,
      traceId: req.traceId
    });

    return sendSuccess(res, toSafeUser(user), "账号已创建", "OK", 201);
  } catch (error) {
    next(error);
  }
});

usersRoutes.delete("/:userId", authenticate, requirePermission("api.users.delete"), (req, res, next) => {
  try {
    const store = getStore();
    const target = store.users.find((user) => user.id === req.params.userId);

    if (!target || target.status !== "active") {
      throw notFound("账号不存在");
    }

    if (target.id === req.currentUser!.id) {
      throw badRequest("不能删除当前登录账号");
    }

    const department = store.departments.find((item) => item.id === target.departmentId);

    if (!department) {
      throw badRequest("账号所属职能不存在");
    }

    const currentUser = req.currentUser!;
    const targetIsAdmin = getUserRoles(target).some((role) => role.code === "admin");

    if (targetIsAdmin && !isAdmin(currentUser)) {
      throw forbidden("只有系统管理员可以删除管理员账号");
    }

    assertCanManageDepartment(req.currentUser!, department.id);

    if (department.leaderUserIds.includes(target.id)) {
      throw badRequest("不能删除当前负责人，请先任命新的负责人");
    }

    const references = getUserBusinessReferences(target.id);

    if (references.length > 0) {
      throw badRequest(`该账号已被${references.join("、")}引用，不能直接删除`);
    }

    const targetIndex = store.users.findIndex((user) => user.id === target.id);

    if (targetIndex >= 0) {
      store.users.splice(targetIndex, 1);
    }

    removeNotificationsForUser(target.id);

    writeAuditLog({
      actorUserId: req.currentUser!.id,
      action: "user.delete",
      targetType: "User",
      targetId: target.id,
      summary: `删除 ${department.name} 账号 ${target.username}`,
      traceId: req.traceId
    });

    return sendSuccess(res, { deleted: true, userId: target.id }, "账号已删除");
  } catch (error) {
    next(error);
  }
});
