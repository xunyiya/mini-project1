import { env } from "./env";

export type DatabaseConfig = {
  provider: "memory" | "external";
  url: string;
  seedMode: "demo";
};

export const databaseConfig: DatabaseConfig = {
  provider: env.databaseUrl.startsWith("memory://") ? "memory" : "external",
  url: env.databaseUrl,
  seedMode: "demo"
};
