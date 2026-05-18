import { env } from "./env";

export type DatabaseConfig = {
  provider: "memory" | "sqlite" | "external";
  url: string;
  seedMode: "demo";
};

export const databaseConfig: DatabaseConfig = {
  provider: env.databaseUrl.startsWith("memory://")
    ? "memory"
    : env.databaseUrl.startsWith("sqlite://")
      ? "sqlite"
      : "external",
  url: env.databaseUrl,
  seedMode: "demo"
};
