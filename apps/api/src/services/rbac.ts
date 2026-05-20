import type {
  AuthMe,
  AvailableActions,
  Department,
  FieldPermissionSummary,
  MenuItem,
  Role,
  SafeUser,
  DepartmentWithLeader
} from "@collab/shared";
import { MENU_ITEMS } from "@collab/shared";
import { getStore, type StoredUser } from "../data/store";
import { forbidden, notFound } from "../lib/errors";

const buttonActionMap: Record<string, Array<{ code: string; action: string }>> = {
  requirements: [
    { code: "button.requirements.create", action: "create" },
    { code: "button.requirements.edit", action: "edit" },
    { code: "button.requirements.submit", action: "submit" },
    { code: "button.requirements.withdraw", action: "withdraw" }
  ],
  reviews: [
    { code: "button.reviews.approve", action: "approve" },
    { code: "button.reviews.reject", action: "reject" },
    { code: "button.reviews.requestSupplement", action: "requestSupplement" },
    { code: "button.reviews.transfer", action: "transfer" }
  ],
  projects: [{ code: "button.projects.create", action: "create" }],
  tasks: [
    { code: "button.tasks.create", action: "create" },
    { code: "button.tasks.update", action: "update" },
    { code: "button.tasks.block", action: "block" }
  ],
  meetings: [{ code: "button.meetings.create", action: "create" }],
  risks: [{ code: "button.risks.create", action: "create" }],
  changes: [{ code: "button.changes.create", action: "create" }],
  defects: [
    { code: "button.defects.create", action: "create" },
    { code: "button.defects.edit", action: "edit" }
  ],
  releases: [{ code: "button.releases.approve", action: "approve" }],
  people: [
    { code: "button.people.create", action: "create" },
    { code: "button.people.delete", action: "delete" },
    { code: "button.people.demoteLeader", action: "demoteLeader" },
    { code: "button.people.promoteLeader", action: "promoteLeader" }
  ],
  admin: [{ code: "button.admin.managePermissions", action: "managePermissions" }]
};

const departmentLeaderPermissions = [
  "menu.people.manage",
  "api.users.read",
  "api.users.create",
  "api.users.delete",
  "button.people.create",
  "button.people.delete"
];

export const reservedFieldPermissions: FieldPermissionSummary = {
  enabled: false,
  policy: "reserved",
  fields: {}
};

export function findUserByLogin(login: string, departmentId: string) {
  const normalizedLogin = login.trim().toLowerCase();
  return getStore().users.find(
    (user) =>
      user.departmentId === departmentId && user.username.toLowerCase() === normalizedLogin
  );
}

export function findUserById(userId: string) {
  return getStore().users.find((user) => user.id === userId);
}

export function requireUserById(userId: string) {
  const user = findUserById(userId);

  if (!user) {
    throw notFound("用户不存在");
  }

  return user;
}

export function getUserRoles(user: StoredUser): Role[] {
  const { roles } = getStore();
  return user.roleIds
    .map((roleId) => roles.find((role) => role.id === roleId))
    .filter((role): role is Role => Boolean(role));
}

export function getDepartment(departmentId: string): Department {
  const department = getStore().departments.find((item) => item.id === departmentId);

  if (!department) {
    throw notFound("部门不存在");
  }

  return department;
}

export function isAdmin(user: StoredUser) {
  return getUserRoles(user).some((role) => role.code === "admin");
}

export function isDepartmentLeader(user: StoredUser, departmentId = user.departmentId) {
  const department = getStore().departments.find((item) => item.id === departmentId);
  return department?.leaderUserIds.includes(user.id) ?? false;
}

export function getManagedDepartmentIds(user: StoredUser) {
  if (isAdmin(user)) {
    return getStore().departments.map((department) => department.id);
  }

  return getStore()
    .departments.filter((department) => department.leaderUserIds.includes(user.id))
    .map((department) => department.id);
}

export function canManageDepartment(user: StoredUser, departmentId: string) {
  return isAdmin(user) || getManagedDepartmentIds(user).includes(departmentId);
}

export function assertCanManageDepartment(user: StoredUser, departmentId: string) {
  if (!canManageDepartment(user, departmentId)) {
    throw forbidden("只能管理自己负责的职能成员");
  }
}

export function getPermissionCodes(user: StoredUser) {
  const dynamicPermissions = getManagedDepartmentIds(user).length > 0 ? departmentLeaderPermissions : [];

  return Array.from(
    new Set([...getUserRoles(user).flatMap((role) => role.permissionCodes), ...dynamicPermissions])
  ).sort();
}

export function hasPermission(user: StoredUser, permissionCode: string) {
  return getPermissionCodes(user).includes(permissionCode);
}

export function assertPermission(user: StoredUser, permissionCode: string) {
  if (!hasPermission(user, permissionCode)) {
    throw forbidden(`缺少权限：${permissionCode}`);
  }
}

export function getVisibleMenus(permissionCodes: string[]): MenuItem[] {
  const permissionSet = new Set(permissionCodes);
  return MENU_ITEMS.filter((item) => permissionSet.has(item.permissionCode));
}

export function getAvailableActions(permissionCodes: string[]): AvailableActions {
  const permissionSet = new Set(permissionCodes);

  return Object.fromEntries(
    Object.entries(buttonActionMap).map(([moduleName, actions]) => [
      moduleName,
      actions
        .filter((action) => permissionSet.has(action.code))
        .map((action) => action.action)
        .sort()
    ])
  );
}

export function toSafeUser(user: StoredUser): SafeUser {
  const department = getDepartment(user.departmentId);
  const roles = getUserRoles(user);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    departmentId: user.departmentId,
    department: {
      id: department.id,
      name: department.name,
      code: department.code
    },
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      code: role.code
    })),
    isDepartmentLeader: department.leaderUserIds.includes(user.id),
    status: user.status,
    title: user.title,
    isSeed: user.isSeed
  };
}

export function toDepartmentWithLeader(department: Department): DepartmentWithLeader {
  const leaders = department.leaderUserIds
    .map((leaderUserId) => findUserById(leaderUserId))
    .filter((leader): leader is StoredUser => Boolean(leader))
    .filter((leader) => leader.status === "active");
  const activeUsers = getStore().users.filter(
    (user) => user.departmentId === department.id && user.status === "active"
  );

  return {
    ...department,
    leaders: leaders.map((leader) => ({
      id: leader.id,
      username: leader.username,
      displayName: leader.displayName,
      title: leader.title
    })),
    memberCount: activeUsers.length
  };
}

export function buildAuthMe(user: StoredUser): AuthMe {
  const permissionCodes = getPermissionCodes(user);
  const roles = getUserRoles(user).map((role) => ({
    id: role.id,
    name: role.name,
    code: role.code
  }));

  return {
    user: toSafeUser(user),
    organization: {
      id: "demo-org",
      name: "Demo 协同研发中心"
    },
    isAdmin: isAdmin(user),
    managedDepartmentIds: getManagedDepartmentIds(user),
    roles,
    permissions: permissionCodes,
    visibleMenus: getVisibleMenus(permissionCodes),
    availableActions: getAvailableActions(permissionCodes),
    fieldPermissions: reservedFieldPermissions,
    unreadNotificationCount: getStore().notifications.filter(
      (notice) => notice.userId === user.id && !notice.read
    ).length
  };
}
