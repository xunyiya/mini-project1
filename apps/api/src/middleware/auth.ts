import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../lib/errors";
import { verifyToken } from "../services/auth";
import { assertPermission } from "../services/rbac";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = header.slice("Bearer ".length).trim();
    req.currentUser = verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.currentUser) {
        throw unauthorized();
      }

      assertPermission(req.currentUser, permissionCode);
      next();
    } catch (error) {
      next(error);
    }
  };
}
