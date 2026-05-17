export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (message = "未登录或登录已过期") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "没有权限执行该操作") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "资源不存在") => new AppError(404, "NOT_FOUND", message);

export const badRequest = (message = "请求参数不正确") => new AppError(400, "BAD_REQUEST", message);

export const conflict = (message = "资源已存在") => new AppError(409, "CONFLICT", message);
