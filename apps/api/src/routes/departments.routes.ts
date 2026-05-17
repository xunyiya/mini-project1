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

      const previousLeaderUserId = department.leaderUserId;
      department.leaderUserId = newLeader.id;

      writeAuditLog({
        actorUserId: req.currentUser!.id,
        action: "department.leader.update",
        targetType: "Department",
        targetId: department.id,
        summary: `将 ${department.name} 负责人从 ${previousLeaderUserId ?? "未设置"} 调整为 ${newLeader.id}`,
        traceId: req.traceId
      });

      return sendSuccess(res, toDepartmentWithLeader(department), "负责人已更新");
    } catch (error) {
      next(error);
    }
  }
);
