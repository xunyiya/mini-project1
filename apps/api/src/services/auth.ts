import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { type StoredUser } from "../data/store";
import { unauthorized } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { findUserByLogin, getDepartment, requireUserById } from "./rbac";

type TokenPayload = {
  sub: string;
  username: string;
  sessionId: string;
};

export function signToken(user: StoredUser) {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      sessionId: crypto.randomUUID()
    } satisfies TokenPayload,
    env.jwtSecret,
    options
  );
}

export function verifyToken(token: string) {
  const payload = jwt.verify(token, env.jwtSecret);

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw unauthorized("Token 无效");
  }

  const user = requireUserById(payload.sub);

  if (user.status !== "active") {
    throw unauthorized("账号已停用");
  }

  return user;
}

export function authenticateByPassword(login: string, password: string, departmentId: string) {
  getDepartment(departmentId);
  const user = findUserByLogin(login, departmentId);

  if (!user || user.status !== "active") {
    throw unauthorized("工号或密码错误");
  }

  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw unauthorized("工号或密码错误");
  }

  return user;
}
