import type { StoredUser } from "../data/store";

declare module "express-serve-static-core" {
  interface Request {
    traceId: string;
    currentUser?: StoredUser;
  }
}
