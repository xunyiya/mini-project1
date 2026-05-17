import { Router } from "express";
import { z } from "zod";
import { getStore } from "../data/store";
import { authenticate, requirePermission } from "../middleware/auth";
import { badRequest } from "../lib/errors";
import { paginate, parsePagination } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import { writeAuditLog } from "../services/audit";
import { requireUserById, toDepartmentWithLeader } from "../services/rbac";

export const departmentsRoutes = Router();

const leaderSchema = z.object({
  userId: z.string().min(1, "请选择负责人")
});

departmentsRoutes.get(
  "/",
  authenticate,
  requirePermission("api.departments.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      return sendSuccess(
        res,
        paginate(getStore().departments.map(toDepartmentWithLeader), page, pageSize)
      );
    } catch (error) {
      next(error);
    }
  }
);

departmentsRoutes.patch(
  "/:departmentId/leader",
  authenticate,
  requirePermission("api.departments.leader.update"),
  (req, res, next) => {
    try {
      const input = leaderSchema.parse(req.body);
      const department = getStore().departments.find((item) => item.id === req.params.departmentId);
      const newLeader = requireUserById(input.userId);

      if (!department) {
        throw badRequest("职能不存在");
      }

      if (newLeader.departmentId !== department.id || newLeader.status !== "active") {
        throw badRequest("负责人必须是该职能下的有效账号");
      }

      const wasLeader = department.leaderUserIds.includes(newLeader.id);

      if (!wasLeader) {
        department.leaderUserIds.push(newLeader.id);
      }

      writeAuditLog({
        actorUserId: req.currentUser!.id,
        action: "department.leader.update",
        targetType: "Department",
        targetId: department.id,
        summary: wasLeader
          ? `${newLeader.id} 已是 ${department.name} 负责人`
          : `将 ${newLeader.id} 添加为 ${department.name} 负责人`,
        traceId: req.traceId
      });

      return sendSuccess(res, toDepartmentWithLeader(department), "负责人已更新");
    } catch (error) {
      next(error);
    }
  }
);

departmentsRoutes.delete(
  "/:departmentId/leader/:userId",
  authenticate,
  requirePermission("api.departments.leader.update"),
  (req, res, next) => {
    try {
      const departmentId = String(req.params.departmentId);
      const userId = String(req.params.userId);
      const department = getStore().departments.find((item) => item.id === departmentId);
      const targetLeader = requireUserById(userId);

      if (!department) {
        throw badRequest("职能不存在");
      }

      if (targetLeader.departmentId !== department.id) {
        throw badRequest("只能移除该职能下的负责人");
      }

      if (!department.leaderUserIds.includes(targetLeader.id)) {
        throw badRequest("该成员不是当前职能负责人");
      }

      if (department.leaderUserIds.length <= 1) {
        throw badRequest("每个职能至少需要保留一名负责人");
      }

      department.leaderUserIds = department.leaderUserIds.filter(
        (leaderUserId) => leaderUserId !== targetLeader.id
      );

      writeAuditLog({
        actorUserId: req.currentUser!.id,
        action: "department.leader.remove",
        targetType: "Department",
        targetId: department.id,
        summary: `将 ${targetLeader.id} 从 ${department.name} 负责人中移除`,
        traceId: req.traceId
      });

      return sendSuccess(res, toDepartmentWithLeader(department), "负责人已移除");
    } catch (error) {
      next(error);
    }
  }
);
