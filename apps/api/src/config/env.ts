import dotenv from "dotenv";

dotenv.config();

const defaultDatabaseUrl = process.env.VITEST
  ? "memory://test"
  : "sqlite://./.data/collab.sqlite";

export const env = {
  appEnv: process.env.APP_ENV ?? "development",
  port: Number(process.env.APP_PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? "day1_demo_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl
};
