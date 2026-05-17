import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingTraceId = req.header("x-trace-id");
  req.traceId = incomingTraceId && incomingTraceId.length <= 128 ? incomingTraceId : crypto.randomUUID();
  res.setHeader("x-trace-id", req.traceId);
  next();
}
