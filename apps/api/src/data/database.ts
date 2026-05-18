import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env";

type SqliteStatement = {
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

type DatabaseSyncConstructor = new (filename: string) => SqliteDatabase;

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: DatabaseSyncConstructor;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function resolveDatabaseFile(databaseUrl: string) {
  if (databaseUrl.startsWith("memory://")) {
    return ":memory:";
  }

  if (!databaseUrl.startsWith("sqlite://")) {
    throw new Error("当前 MVP 数据库仅支持 sqlite:// 或 memory:// DATABASE_URL");
  }

  const rawPath = databaseUrl.replace(/^sqlite:\/\//, "");
  const databaseFile = rawPath.startsWith("file:")
    ? fileURLToPath(rawPath)
    : rawPath;

  if (databaseFile === ":memory:") {
    return databaseFile;
  }

  return path.isAbsolute(databaseFile)
    ? databaseFile
    : path.resolve(repoRoot, databaseFile);
}

const databaseFile = resolveDatabaseFile(env.databaseUrl);

if (databaseFile !== ":memory:") {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
}

export const database = new DatabaseSync(databaseFile);

database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

export function getDatabaseInfo() {
  return {
    provider: databaseFile === ":memory:" ? "memory" : "sqlite",
    file: databaseFile,
    stateKey: "main"
  };
}
