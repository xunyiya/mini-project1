import type { AuditLog, Department, Notification, Permission, Role, User } from "@collab/shared";
import { buildDemoData } from "./seed";

export type StoredUser = User & {
  passwordSalt: string;
  passwordHash: string;
};

export type InMemoryStore = {
  departments: Department[];
  permissions: Permission[];
  roles: Role[];
  users: StoredUser[];
  auditLogs: AuditLog[];
  notifications: Notification[];
};

let store: InMemoryStore = buildDemoData();

export function getStore() {
  return store;
}

export function resetStore() {
  store = buildDemoData();
  return store;
}
