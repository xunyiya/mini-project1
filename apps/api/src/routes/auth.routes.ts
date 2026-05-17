import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { getStore } from "../data/store";
import { authenticate } from "../middleware/auth";
import { sendSuccess } from "../lib/response";
import { authenticateByPassword, signToken } from "../services/auth";
import { writeAuditLog } from "../services/audit";
import { buildAuthMe, findUserById } from "../services/rbac";

const loginSchema = z.object({
  departmentId: z.string().min(1, "请选择职能"),
  login: z
    .string()
    .min(1, "请输入工号")
    .regex(/^\d+$/, "工号只能包含数字"),
  password: z.string().min(1, "请输入密码")
});

export const authRoutes = Router();

authRoutes.get("/login-options", (_req, res) => {
  const { departments } = getStore();

  return sendSuccess(res, {
    departments: departments.map((department) => {
      const leader = department.leaderUserId ? findUserById(department.leaderUserId) : undefined;

      return {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        leaderUserId: department.leaderUserId,
        leader: leader
          ? {
              id: leader.id,
              username: leader.username,
            displayName: leader.displayName,
            title: leader.title
          }
          : null
      };
    })
  });
});

authRoutes.post("/login", (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = authenticateByPassword(input.login, input.password, input.departmentId);
    const token = signToken(user);

    writeAuditLog({
      actorUserId: user.id,
      action: "auth.login",
      targetType: "User",
      targetId: user.id,
      summary: `用户从职能 ${input.departmentId} 登录系统`,
      traceId: req.traceId
    });

    return sendSuccess(
      res,
      {
        token,
        tokenType: "Bearer",
        expiresIn: env.jwtExpiresIn,
        me: buildAuthMe(user)
      },
      "登录成功"
    );
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/logout", authenticate, (req, res, next) => {
  try {
    const user = req.currentUser;

    if (user) {
      writeAuditLog({
        actorUserId: user.id,
        action: "auth.logout",
        targetType: "User",
        targetId: user.id,
        summary: "用户退出系统",
        traceId: req.traceId
      });
    }

    return sendSuccess(res, { loggedOut: true }, "退出成功");
  } catch (error) {
    next(error);
  }
});

authRoutes.get("/me", authenticate, (req, res, next) => {
  try {
    return sendSuccess(res, buildAuthMe(req.currentUser!), "success");
  } catch (error) {
    next(error);
  }
});
