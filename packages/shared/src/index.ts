export type ApiResponse<T> = {
  code: string;
  message: string;
  data: T;
  traceId: string;
};

export type PageData<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  description: string;
  leaderUserId?: string;
  parentId?: string;
  isSeed: true;
};

export type PermissionType = "menu" | "button" | "api" | "field";

export type Permission = {
  id: string;
  code: string;
  name: string;
  type: PermissionType;
  description: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
  isSeed: true;
};

export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  departmentId: string;
  roleIds: string[];
  status: UserStatus;
  title: string;
  isSeed: true;
};

export type SafeUser = Omit<User, "roleIds"> & {
  department: Pick<Department, "id" | "name" | "code">;
  roles: Pick<Role, "id" | "name" | "code">[];
  isDepartmentLeader: boolean;
};

export type DepartmentWithLeader = Department & {
  leader: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  memberCount: number;
};

export type AuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  traceId: string;
  createdAt: string;
  isSeed: true;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: "todo" | "approval" | "system" | "risk";
  read: boolean;
  createdAt: string;
  isSeed: true;
};

export type MenuItem = {
  key: string;
  label: string;
  path: string;
  permissionCode: string;
};

export type AvailableActions = Record<string, string[]>;

export type FieldPermissionSummary = {
  enabled: false;
  policy: "reserved";
  fields: Record<string, never>;
};

export type PermissionSummary = {
  roles: Pick<Role, "id" | "name" | "code">[];
  permissionCodes: string[];
  menus: MenuItem[];
  buttons: AvailableActions;
  fields: FieldPermissionSummary;
};

export type AuthMe = {
  user: SafeUser;
  organization: {
    id: "demo-org";
    name: "Demo 协同研发中心";
  };
  isAdmin: boolean;
  managedDepartmentIds: string[];
  roles: Pick<Role, "id" | "name" | "code">[];
  permissions: string[];
  visibleMenus: MenuItem[];
  availableActions: AvailableActions;
  fieldPermissions: FieldPermissionSummary;
  unreadNotificationCount: number;
};

export type LoginResult = {
  token: string;
  tokenType: "Bearer";
  expiresIn: string;
  me: AuthMe;
};

export type LoginOptions = {
  departments: Array<
    Pick<Department, "id" | "name" | "code" | "description" | "leaderUserId"> & {
      leader: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
    }
  >;
};

export type CreateUserInput = {
  departmentId: string;
  displayName: string;
  email: string;
  title: string;
  password: string;
};

export type UpdateDepartmentLeaderInput = {
  userId: string;
};

export const API_PREFIX = "/api/v1";

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "dashboard",
    label: "首页工作台",
    path: "/",
    permissionCode: "menu.dashboard.view"
  },
  {
    key: "requirements",
    label: "需求池",
    path: "/requirements",
    permissionCode: "menu.requirements.view"
  },
  {
    key: "reviews",
    label: "评审审批",
    path: "/reviews",
    permissionCode: "menu.reviews.view"
  },
  {
    key: "projects",
    label: "项目空间",
    path: "/projects",
    permissionCode: "menu.projects.view"
  },
  {
    key: "tasks",
    label: "任务看板",
    path: "/tasks",
    permissionCode: "menu.tasks.view"
  },
  {
    key: "meetings",
    label: "会议纪要",
    path: "/meetings",
    permissionCode: "menu.meetings.view"
  },
  {
    key: "risks",
    label: "风险台账",
    path: "/risks",
    permissionCode: "menu.risks.view"
  },
  {
    key: "changes",
    label: "变更申请",
    path: "/changes",
    permissionCode: "menu.changes.view"
  },
  {
    key: "defects",
    label: "缺陷处理",
    path: "/defects",
    permissionCode: "menu.defects.view"
  },
  {
    key: "releases",
    label: "上线计划",
    path: "/releases",
    permissionCode: "menu.releases.view"
  },
  {
    key: "notifications",
    label: "消息中心",
    path: "/notifications",
    permissionCode: "menu.notifications.view"
  },
  {
    key: "people",
    label: "职能成员",
    path: "/people",
    permissionCode: "menu.people.manage"
  },
  {
    key: "admin",
    label: "权限配置",
    path: "/admin",
    permissionCode: "menu.admin.view"
  }
];
