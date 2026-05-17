import type { ApiResponse } from "@collab/shared";
import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "success",
  code = "OK",
  status = 200
) {
  const traceId = res.req.traceId;
  const body: ApiResponse<T> = {
    code,
    message,
    data,
    traceId
  };

  return res.status(status).json(body);
}
