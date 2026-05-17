import { API_PREFIX } from "@collab/shared";
import cors from "cors";
import express, { Router } from "express";
import { databaseConfig } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { traceMiddleware } from "./middleware/trace";
import { authRoutes } from "./routes/auth.routes";
import { departmentsRoutes } from "./routes/departments.routes";
import { permissionsRoutes } from "./routes/permissions.routes";
import { usersRoutes } from "./routes/users.routes";
import { sendSuccess } from "./lib/response";

export function createApp() {
  const app = express();
  const v1 = Router();

  app.use(cors());
  app.use(express.json());
  app.use(traceMiddleware);

  v1.get("/health", (_req, res) =>
    sendSuccess(res, {
      status: "ok",
      database: databaseConfig
    })
  );
  v1.use("/auth", authRoutes);
  v1.use("/users", usersRoutes);
  v1.use("/departments", departmentsRoutes);
  v1.use("/permissions", permissionsRoutes);

  app.use(API_PREFIX, v1);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
