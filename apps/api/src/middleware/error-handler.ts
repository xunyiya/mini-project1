import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "NOT_FOUND", `接口不存在：${req.method} ${req.path}`));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "参数校验失败",
      data: {
        details: error.flatten()
      },
      traceId: req.traceId
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
      data: error.details ?? null,
      traceId: req.traceId
    });
  }

  console.error(error);

  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "服务暂时不可用",
    data: null,
    traceId: req.traceId
  });
}
