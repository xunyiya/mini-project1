import type { ChangePasswordInput } from "@collab/shared";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { getStore } from "../data/store";
import { authenticate } from "../middleware/auth";
import { badRequest, unauthorized } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
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

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z
      .string()
      .min(8, "新密码至少 8 个字符")
      .max(72, "新密码最多 72 个字符")
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"]
  });

export const authRoutes = Router();

authRoutes.get("/login-options", (_req, res) => {
  const { departments } = getStore();

  return sendSuccess(res, {
    departments: departments.map((department) => {
      const leaders = department.leaderUserIds
        .map((leaderUserId) => findUserById(leaderUserId))
        .filter((leader) => leader?.status === "active");

      return {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        leaderUserIds: department.leaderUserIds,
        leaders: leaders.map((leader) => ({
          id: leader!.id,
          username: leader!.username,
          displayName: leader!.displayName,
          title: leader!.title
        }))
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

authRoutes.patch("/password", authenticate, (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body) as ChangePasswordInput;
    const user = req.currentUser!;

    if (!verifyPassword(input.currentPassword, user.passwordSalt, user.passwordHash)) {
      throw unauthorized("当前密码不正确");
    }

    const { salt, hash } = hashPassword(input.newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;

    writeAuditLog({
      actorUserId: user.id,
      action: "auth.password.change",
      targetType: "User",
      targetId: user.id,
      summary: "用户修改登录密码",
      traceId: req.traceId
    });

    return sendSuccess(res, { changed: true }, "密码已修改");
  } catch (error) {
    if (error instanceof RangeError) {
      next(badRequest("密码格式不正确"));
      return;
    }

    next(error);
  }
});
