import type {
  AuditLog,
  BugTicket,
  Department,
  Notification,
  Permission,
  Project,
  Requirement,
  RequirementStatusHistory,
  ReviewFlow,
  ReviewNode,
  Role,
  Task,
  TaskStatusHistory,
  User,
  WorkflowTemplate
} from "@collab/shared";
import { database, getDatabaseInfo } from "./database";
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
  requirements: Requirement[];
  requirementStatusHistories: RequirementStatusHistory[];
  projects: Project[];
  tasks: Task[];
  taskStatusHistories: TaskStatusHistory[];
  bugTickets: BugTicket[];
  reviewFlows: ReviewFlow[];
  reviewNodes: ReviewNode[];
  workflowTemplates: WorkflowTemplate[];
  auditLogs: AuditLog[];
  notifications: Notification[];
};

const storeKey = "main";
const mutatingArrayMethods = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift"
]);

let rawStore: InMemoryStore = loadStore();
let store: InMemoryStore = createReactiveStore(rawStore);

function normalizeStore(input: Partial<InMemoryStore>): InMemoryStore {
  const fallback = buildDemoData();
  const fallbackPermissionCodes = new Set(fallback.permissions.map((permission) => permission.code));
  const normalized: InMemoryStore = {
    departments: input.departments ?? fallback.departments,
    permissions: [
      ...(input.permissions ?? []),
      ...fallback.permissions.filter(
        (permission) =>
          !(input.permissions ?? []).some((currentPermission) => currentPermission.code === permission.code)
      )
    ],
    roles: input.roles ?? fallback.roles,
    users: input.users ?? fallback.users,
    requirements: input.requirements ?? fallback.requirements,
    requirementStatusHistories:
      input.requirementStatusHistories ?? fallback.requirementStatusHistories,
    projects: input.projects ?? fallback.projects,
    tasks: input.tasks ?? fallback.tasks,
    taskStatusHistories: input.taskStatusHistories ?? fallback.taskStatusHistories,
    bugTickets: input.bugTickets ?? fallback.bugTickets,
    reviewFlows: input.reviewFlows ?? fallback.reviewFlows,
    reviewNodes: input.reviewNodes ?? fallback.reviewNodes,
    workflowTemplates: input.workflowTemplates ?? fallback.workflowTemplates,
    auditLogs: input.auditLogs ?? fallback.auditLogs,
    notifications: input.notifications ?? fallback.notifications
  };

  normalized.requirements = normalizeRequirementCodes(
    normalized.requirements.map((requirement) => ({
      ...requirement,
      reviewApproverAssignments: requirement.reviewApproverAssignments ?? {},
      projectMembers: requirement.projectMembers ?? [],
      pendingChangeReview: requirement.pendingChangeReview
    }))
  );
  normalized.roles = normalized.roles.map((role) => {
    const fallbackRole = fallback.roles.find((item) => item.id === role.id);
    const nextPermissionCodes = new Set(role.permissionCodes);

    if (fallbackRole) {
      fallbackRole.permissionCodes
        .filter((permissionCode) => fallbackPermissionCodes.has(permissionCode))
        .forEach((permissionCode) => nextPermissionCodes.add(permissionCode));
    }

    return {
      ...role,
      permissionCodes: Array.from(nextPermissionCodes)
    };
  });

  return normalized;
}

function normalizeRequirementCodes(requirements: Requirement[]) {
  const normalizedRequirements = requirements.map((requirement) => ({ ...requirement }));
  const sortedRequirements = [...normalizedRequirements].sort((left, right) => {
    const timeDiff =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

    return timeDiff || left.id.localeCompare(right.id);
  });

  sortedRequirements.forEach((requirement, index) => {
    requirement.code = `X${index + 1}`;
  });

  return normalizedRequirements;
}

function loadStore() {
  const row = database
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(storeKey) as { value?: string } | undefined;

  if (!row?.value) {
    const seededStore = buildDemoData();
    persistStore(seededStore);
    return seededStore;
  }

  try {
    return normalizeStore(JSON.parse(row.value) as Partial<InMemoryStore>);
  } catch {
    const seededStore = buildDemoData();
    persistStore(seededStore);
    return seededStore;
  }
}

function persistStore(nextStore = rawStore) {
  database
    .prepare(
      `
        INSERT INTO app_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `
    )
    .run(storeKey, JSON.stringify(nextStore), new Date().toISOString());
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function createReactiveStore<T extends object>(target: T, cache = new WeakMap<object, object>()): T {
  if (cache.has(target)) {
    return cache.get(target) as T;
  }

  const proxy = new Proxy(target, {
    get(currentTarget, property, receiver) {
      if (Array.isArray(currentTarget) && typeof property === "string" && mutatingArrayMethods.has(property)) {
        return (...args: unknown[]) => {
          const method = Reflect.get(currentTarget, property, currentTarget) as (...methodArgs: unknown[]) => unknown;
          const result = method.apply(currentTarget, args);
          persistStore();
          return result;
        };
      }

      const value = Reflect.get(currentTarget, property, receiver);
      return isRecord(value) ? createReactiveStore(value, cache) : value;
    },
    set(currentTarget, property, value, receiver) {
      const previousValue = Reflect.get(currentTarget, property, receiver);
      const result = Reflect.set(currentTarget, property, value, receiver);

      if (previousValue !== value) {
        persistStore();
      }

      return result;
    },
    deleteProperty(currentTarget, property) {
      const result = Reflect.deleteProperty(currentTarget, property);
      persistStore();
      return result;
    }
  });

  cache.set(target, proxy);
  return proxy;
}

export function getStore() {
  return store;
}

export function resetStore() {
  rawStore = buildDemoData();
  store = createReactiveStore(rawStore);
  persistStore();
  return store;
}

export function reloadStore() {
  rawStore = loadStore();
  store = createReactiveStore(rawStore);
  return store;
}

export { getDatabaseInfo };
