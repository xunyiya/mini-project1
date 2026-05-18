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
  leaderUserIds: string[];
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
  leaders: Array<Pick<SafeUser, "id" | "username" | "displayName" | "title">>;
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
  entityType?: string;
  entityId?: string;
  readAt?: string;
  createdAt: string;
  isSeed: true;
};

export type RequirementSource =
  | "CUSTOMER"
  | "OPERATION"
  | "PRODUCT"
  | "BOSS"
  | "SALES"
  | "CS"
  | "DATA"
  | "OTHER";

export type RequirementType =
  | "FEATURE"
  | "OPTIMIZATION"
  | "BUGFIX"
  | "DATA"
  | "COMPLIANCE"
  | "ACTIVITY"
  | "OTHER";

export type RequirementPriority = "P0" | "P1" | "P2" | "P3";

export type RequirementStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "NEEDS_SUPPLEMENT"
  | "REJECTED"
  | "APPROVED"
  | "WITHDRAWN"
  | "SCHEDULED"
  | "PLANNING_DONE"
  | "UI_DESIGNING"
  | "UI_DESIGN_DONE"
  | "IN_DEVELOPMENT"
  | "DEVELOPMENT_DONE"
  | "IN_TESTING"
  | "TESTING_DONE"
  | "ACCEPTANCE"
  | "ACCEPTANCE_DONE"
  | "PENDING_RELEASE"
  | "RELEASED"
  | "DELIVERED"
  | "ARCHIVED";

export type RequirementAttachment = {
  name: string;
  url: string;
};

export type RequirementProjectMemberRole =
  | "FRONTEND"
  | "BACKEND"
  | "TEST"
  | "PRODUCT"
  | "UI_DESIGN"
  | "OTHER";

export type RequirementProjectMember = {
  role: RequirementProjectMemberRole;
  userId: string;
};

export type RequirementPendingChangeReview = {
  returnStatus: RequirementStatus;
  changedFields: string[];
  nodeTypes: ReviewNodeType[];
  requestedBy: string;
  requestedAt: string;
};

export type Requirement = {
  id: string;
  code: string;
  title: string;
  description: string;
  background: string;
  goal: string;
  source?: RequirementSource;
  type?: RequirementType;
  priority?: RequirementPriority;
  status: RequirementStatus;
  departmentId?: string;
  ownerId?: string;
  submitterId: string;
  expectedReleaseDate?: string;
  relatedDepartments: string[];
  impactScope: string;
  successMetric?: string;
  attachments: RequirementAttachment[];
  reviewApproverAssignments?: Partial<Record<ReviewNodeType, string>>;
  projectMembers: RequirementProjectMember[];
  pendingChangeReview?: RequirementPendingChangeReview;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  withdrawnAt?: string;
  isSeed: true;
};

export type RequirementStatusHistory = {
  id: string;
  entityType: "requirement";
  entityId: string;
  fromStatus?: RequirementStatus;
  toStatus: RequirementStatus;
  operatorId: string;
  reason: string;
  createdAt: string;
  isSeed: true;
};

export type RequirementView = Requirement & {
  submitter: Pick<SafeUser, "id" | "username" | "displayName" | "title">;
  owner: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  department: Pick<Department, "id" | "name" | "code"> | null;
  relatedDepartmentInfos: Array<Pick<Department, "id" | "name" | "code">>;
  availableActions: Array<
    | "view"
    | "edit"
    | "editFollower"
    | "editPeople"
    | "editCoreChange"
    | "submitReview"
    | "submitChangeReview"
    | "withdraw"
    | "startReview"
  >;
};

export type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE"
  | "CANCELED"
  | "ARCHIVED";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELED";

export type TaskType =
  | "PRODUCT"
  | "DESIGN"
  | "FRONTEND"
  | "BACKEND"
  | "TEST"
  | "DATA"
  | "OPERATION"
  | "LEGAL"
  | "SECURITY"
  | "OTHER";

export type Project = {
  id: string;
  code: string;
  name: string;
  requirementId: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  participantDepartmentIds: string[];
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedReleaseDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isSeed: true;
};

export type Task = {
  id: string;
  code: string;
  projectId: string;
  requirementId?: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: RequirementPriority;
  assigneeId: string;
  departmentId: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  blockerReason?: string;
  dependencyTaskIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isSeed: true;
};

export type TaskStatusHistory = {
  id: string;
  taskId: string;
  fromStatus?: TaskStatus;
  toStatus: TaskStatus;
  operatorId: string;
  reason: string;
  createdAt: string;
  isSeed: true;
};

export type ProjectView = Project & {
  requirement: Pick<Requirement, "id" | "code" | "title" | "status"> | null;
  owner: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  creator: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  participantDepartments: Array<Pick<Department, "id" | "name" | "code">>;
  progress: number;
  taskStats: Record<TaskStatus, number>;
  taskCompletionRate: number;
  riskCount: number;
  availableActions: Array<"view" | "edit" | "start" | "complete" | "createTask">;
};

export type TaskView = Task & {
  project: Pick<Project, "id" | "code" | "name" | "status" | "ownerId"> | null;
  requirement: Pick<Requirement, "id" | "code" | "title" | "status"> | null;
  assignee: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  department: Pick<Department, "id" | "name" | "code"> | null;
  dependencies: Array<Pick<Task, "id" | "code" | "title" | "status">>;
  statusHistories: TaskStatusHistory[];
  availableActions: Array<"view" | "edit" | "updateStatus" | "setDependencies">;
  overdue: boolean;
};

export type ProjectTaskBoard = {
  items: TaskView[];
  board: Record<TaskStatus, TaskView[]>;
};

export type ReviewFlowStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_SUPPLEMENT"
  | "CANCELED";

export type ReviewNodeType =
  | "PRODUCT"
  | "TECH"
  | "TEST"
  | "DESIGN"
  | "OPERATION"
  | "LEGAL"
  | "SECURITY"
  | "DATA"
  | "CUSTOM";

export type ReviewNodeStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_SUPPLEMENT"
  | "TRANSFERRED"
  | "SKIPPED";

export type ReviewFlow = {
  id: string;
  requirementId: string;
  templateId?: string;
  reviewKind?: "INITIAL" | "CHANGE";
  returnStatus?: RequirementStatus;
  status: ReviewFlowStatus;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  isSeed: true;
};

export type ReviewNode = {
  id: string;
  flowId: string;
  nodeName: string;
  nodeType: ReviewNodeType;
  approverId: string;
  status: ReviewNodeStatus;
  comment?: string;
  orderIndex: number;
  dueAt?: string;
  handledAt?: string;
  transferredToId?: string;
  required: boolean;
  selfApproval?: boolean;
  isSeed: true;
};

export type WorkflowTemplateNodeConfig = {
  nodeName: string;
  nodeType: ReviewNodeType;
  defaultApproverUserId?: string;
  defaultRoleCode?: string;
  defaultDepartmentId?: string;
  required: boolean;
  orderIndex: number;
  dueInHours?: number;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  appliesTo: "REQUIREMENT";
  isDefault: boolean;
  enabled: boolean;
  nodesConfig: WorkflowTemplateNodeConfig[];
  createdAt: string;
  updatedAt: string;
  isSeed: true;
};

export type ReviewNodeView = ReviewNode & {
  approver: Pick<SafeUser, "id" | "username" | "displayName" | "title">;
  transferredTo?: Pick<SafeUser, "id" | "username" | "displayName" | "title"> | null;
  availableActions: Array<"approve" | "reject" | "requestSupplement" | "transfer">;
};

export type RequirementReviewSummary = {
  flow: (ReviewFlow & { template?: Pick<WorkflowTemplate, "id" | "name" | "description"> | null }) | null;
  nodes: ReviewNodeView[];
};

export type MyReviewItem = {
  flow: ReviewFlow;
  node: ReviewNodeView;
  requirement: RequirementView;
};

export type SubmitReviewInput = {
  templateId?: string;
  approverAssignments?: Record<string, string>;
  reviewKind?: "INITIAL" | "CHANGE";
  nodeTypes?: ReviewNodeType[];
};

export type ReviewActionInput = {
  comment?: string;
};

export type ReviewTransferInput = {
  targetUserId: string;
  reason: string;
};

export type WorkflowTemplateCreateInput = {
  name: string;
  description: string;
  appliesTo: "REQUIREMENT";
  isDefault?: boolean;
  enabled?: boolean;
  nodesConfig: WorkflowTemplateNodeConfig[];
};

export type WorkflowTemplateUpdateInput = Partial<WorkflowTemplateCreateInput>;

export type RequirementCreateInput = {
  title: string;
  description: string;
  background?: string;
  goal?: string;
  source?: RequirementSource;
  type?: RequirementType;
  priority?: RequirementPriority;
  departmentId?: string;
  ownerId?: string;
  expectedReleaseDate?: string;
  relatedDepartments?: string[];
  impactScope?: string;
  successMetric?: string;
  attachments?: RequirementAttachment[];
  reviewApproverAssignments?: Partial<Record<ReviewNodeType, string>>;
  projectMembers?: RequirementProjectMember[];
};

export type RequirementUpdateInput = Partial<RequirementCreateInput>;

export type ProjectCreateInput = {
  requirementId: string;
  name?: string;
  description?: string;
  ownerId: string;
  participantDepartmentIds?: string[];
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedReleaseDate?: string;
};

export type ProjectUpdateInput = Partial<Omit<ProjectCreateInput, "requirementId">>;

export type TaskCreateInput = {
  title: string;
  description?: string;
  taskType: TaskType;
  priority?: RequirementPriority;
  assigneeId: string;
  departmentId: string;
  startDate?: string;
  dueDate?: string;
  dependencyTaskIds?: string[];
};

export type TaskUpdateInput = Partial<TaskCreateInput>;

export type TaskStatusInput = {
  status: TaskStatus;
  reason?: string;
  blockerReason?: string;
};

export type TaskDependenciesInput = {
  dependencyTaskIds: string[];
};

export const REQUIREMENT_SOURCES: RequirementSource[] = [
  "CUSTOMER",
  "OPERATION",
  "PRODUCT",
  "BOSS",
  "SALES",
  "CS",
  "DATA",
  "OTHER"
];

export const REQUIREMENT_TYPES: RequirementType[] = [
  "FEATURE",
  "OPTIMIZATION",
  "BUGFIX",
  "DATA",
  "COMPLIANCE",
  "ACTIVITY",
  "OTHER"
];

export const REQUIREMENT_PRIORITIES: RequirementPriority[] = ["P0", "P1", "P2", "P3"];

export const REQUIREMENT_STATUSES: RequirementStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "IN_REVIEW",
  "NEEDS_SUPPLEMENT",
  "REJECTED",
  "APPROVED",
  "WITHDRAWN",
  "SCHEDULED",
  "PLANNING_DONE",
  "UI_DESIGNING",
  "UI_DESIGN_DONE",
  "IN_DEVELOPMENT",
  "DEVELOPMENT_DONE",
  "IN_TESTING",
  "TESTING_DONE",
  "ACCEPTANCE",
  "ACCEPTANCE_DONE",
  "PENDING_RELEASE",
  "RELEASED",
  "DELIVERED",
  "ARCHIVED"
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "CANCELED",
  "ARCHIVED"
];

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "CANCELED"
];

export const TASK_TYPES: TaskType[] = [
  "PRODUCT",
  "DESIGN",
  "FRONTEND",
  "BACKEND",
  "TEST",
  "DATA",
  "OPERATION",
  "LEGAL",
  "SECURITY",
  "OTHER"
];

export const REQUIREMENT_SOURCE_LABELS: Record<RequirementSource, string> = {
  CUSTOMER: "客户",
  OPERATION: "运营",
  PRODUCT: "产品",
  BOSS: "老板",
  SALES: "销售",
  CS: "客服",
  DATA: "数据",
  OTHER: "其他"
};

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  FEATURE: "新功能",
  OPTIMIZATION: "优化",
  BUGFIX: "缺陷修复",
  DATA: "数据",
  COMPLIANCE: "合规",
  ACTIVITY: "活动",
  OTHER: "其他"
};

export const REQUIREMENT_PRIORITY_LABELS: Record<RequirementPriority, string> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3"
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待评审",
  IN_REVIEW: "评审中",
  NEEDS_SUPPLEMENT: "需补充",
  REJECTED: "已驳回",
  APPROVED: "已通过",
  WITHDRAWN: "已撤回",
  SCHEDULED: "策划中",
  PLANNING_DONE: "策划完成",
  UI_DESIGNING: "UI设计中",
  UI_DESIGN_DONE: "UI设计完成",
  IN_DEVELOPMENT: "开发中",
  DEVELOPMENT_DONE: "开发完成",
  IN_TESTING: "测试中",
  TESTING_DONE: "测试完成",
  ACCEPTANCE: "验收中",
  ACCEPTANCE_DONE: "验收完成",
  PENDING_RELEASE: "待上线",
  RELEASED: "已上线",
  DELIVERED: "交付",
  ARCHIVED: "已归档"
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "规划中",
  IN_PROGRESS: "进行中",
  BLOCKED: "阻塞中",
  DONE: "已完成",
  CANCELED: "已取消",
  ARCHIVED: "已归档"
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "待开始",
  IN_PROGRESS: "进行中",
  BLOCKED: "阻塞中",
  DONE: "已完成",
  CANCELED: "已取消"
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  PRODUCT: "产品",
  DESIGN: "设计",
  FRONTEND: "前端",
  BACKEND: "后端",
  TEST: "测试",
  DATA: "数据",
  OPERATION: "运营",
  LEGAL: "法务",
  SECURITY: "安全",
  OTHER: "其他"
};

export const REQUIREMENT_PROJECT_MEMBER_ROLE_LABELS: Record<RequirementProjectMemberRole, string> = {
  FRONTEND: "前端",
  BACKEND: "后端",
  TEST: "测试",
  PRODUCT: "产品",
  UI_DESIGN: "UI 设计",
  OTHER: "其他"
};

export const REVIEW_FLOW_STATUS_LABELS: Record<ReviewFlowStatus, string> = {
  PENDING: "待开始",
  IN_PROGRESS: "评审中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  NEEDS_SUPPLEMENT: "需补充",
  CANCELED: "已取消"
};

export const REVIEW_NODE_STATUS_LABELS: Record<ReviewNodeStatus, string> = {
  PENDING: "待处理",
  IN_PROGRESS: "处理中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  NEEDS_SUPPLEMENT: "需补充",
  TRANSFERRED: "已转派",
  SKIPPED: "已跳过"
};

export const REVIEW_NODE_TYPE_LABELS: Record<ReviewNodeType, string> = {
  PRODUCT: "产品评审",
  TECH: "技术评审",
  TEST: "测试评审",
  DESIGN: "设计评审",
  OPERATION: "运营确认",
  LEGAL: "法务评审",
  SECURITY: "安全评审",
  DATA: "数据评审",
  CUSTOM: "自定义"
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
    Pick<Department, "id" | "name" | "code" | "description" | "leaderUserIds"> & {
      leaders: Array<Pick<SafeUser, "id" | "username" | "displayName" | "title">>;
    }
  >;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
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
    key: "profile",
    label: "个人信息",
    path: "/profile",
    permissionCode: "menu.profile.view"
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
