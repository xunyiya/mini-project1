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
  ReviewFlowStatus,
  ReviewNode,
  ReviewNodeStatus,
  Role,
  Task,
  TaskStatusHistory,
  User,
  WorkflowTemplate
} from "@collab/shared";
import { hashPassword } from "../lib/password";

export type StoredUserSeed = User & {
  passwordSalt: string;
  passwordHash: string;
};

export type DemoData = {
  departments: Department[];
  permissions: Permission[];
  roles: Role[];
  users: StoredUserSeed[];
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

const DEMO_PASSWORD = "Demo@123456";

function permission(
  code: string,
  name: string,
  type: Permission["type"],
  description: string
): Permission {
  return {
    id: `perm_${code.replaceAll(".", "_")}`,
    code,
    name,
    type,
    description
  };
}

const menuPermissions = [
  permission("menu.dashboard.view", "查看首页工作台", "menu", "访问首页工作台"),
  permission("menu.profile.view", "查看个人信息", "menu", "访问个人信息菜单"),
  permission("menu.requirements.view", "查看需求池", "menu", "访问需求池菜单"),
  permission("menu.reviews.view", "查看评审审批", "menu", "访问评审审批菜单"),
  permission("menu.projects.view", "查看项目空间", "menu", "访问项目空间菜单"),
  permission("menu.tasks.view", "查看任务看板", "menu", "访问任务看板菜单"),
  permission("menu.meetings.view", "查看会议纪要", "menu", "访问会议纪要菜单"),
  permission("menu.risks.view", "查看风险台账", "menu", "访问风险台账菜单"),
  permission("menu.changes.view", "查看变更申请", "menu", "访问变更申请菜单"),
  permission("menu.defects.view", "查看bug单", "menu", "访问bug单菜单"),
  permission("menu.releases.view", "查看上线计划", "menu", "访问上线计划菜单"),
  permission("menu.notifications.view", "查看消息中心", "menu", "访问消息中心菜单"),
  permission("menu.people.manage", "管理职能成员", "menu", "访问职能成员管理菜单"),
  permission("menu.admin.view", "查看权限配置", "menu", "访问权限配置菜单")
];

const apiPermissions = [
  permission("api.users.read", "查询用户", "api", "读取用户列表"),
  permission("api.users.create", "创建用户", "api", "创建职能账号"),
  permission("api.users.delete", "删除用户", "api", "删除职能账号"),
  permission("api.requirements.read", "查询需求", "api", "读取需求池和需求详情"),
  permission("api.requirements.create", "创建需求", "api", "创建需求草稿"),
  permission("api.requirements.update", "编辑需求", "api", "编辑需求基础字段"),
  permission("api.requirements.submit", "提交需求评审", "api", "提交需求进入待评审"),
  permission("api.requirements.withdraw", "撤回需求", "api", "撤回待评审需求"),
  permission("api.projects.read", "查询项目", "api", "读取项目空间和项目详情"),
  permission("api.projects.create", "创建项目", "api", "从已通过需求创建项目"),
  permission("api.projects.update", "编辑项目", "api", "编辑项目基础字段和状态"),
  permission("api.tasks.read", "查询任务", "api", "读取项目任务和我的任务"),
  permission("api.tasks.create", "创建任务", "api", "在项目中创建任务"),
  permission("api.tasks.update", "编辑任务", "api", "编辑任务基础字段、状态和依赖"),
  permission("api.defects.read", "查询bug单", "api", "读取bug单列表和详情"),
  permission("api.defects.create", "创建bug单", "api", "登记测试和上线过程中的bug"),
  permission("api.defects.update", "编辑bug单", "api", "维护bug状态、处理人和关联人"),
  permission("api.reviews.read", "查询评审", "api", "读取待评审列表和评审记录"),
  permission("api.reviews.handle", "处理评审", "api", "通过、驳回、补充或转派评审节点"),
  permission("api.workflowTemplates.read", "查询流程模板", "api", "读取流程模板"),
  permission("api.workflowTemplates.create", "创建流程模板", "api", "创建评审流程模板"),
  permission("api.workflowTemplates.update", "编辑流程模板", "api", "编辑评审流程模板"),
  permission("api.departments.read", "查询部门", "api", "读取部门列表"),
  permission("api.departments.leader.update", "任命职能负责人", "api", "更新职能负责人"),
  permission("api.permissions.summary.read", "查询权限摘要", "api", "读取当前用户权限摘要")
];

const buttonPermissions = [
  permission("button.requirements.create", "创建需求", "button", "在需求池创建需求"),
  permission("button.requirements.edit", "编辑需求", "button", "编辑需求草稿或待补充需求"),
  permission("button.requirements.submit", "提交评审", "button", "提交需求进入评审"),
  permission("button.requirements.withdraw", "撤回需求", "button", "撤回待评审需求"),
  permission("button.reviews.approve", "评审通过", "button", "通过评审节点"),
  permission("button.reviews.reject", "评审驳回", "button", "驳回评审节点"),
  permission("button.reviews.requestSupplement", "要求补充", "button", "要求需求补充信息"),
  permission("button.reviews.transfer", "转派评审", "button", "转派当前评审节点"),
  permission("button.projects.create", "创建项目", "button", "从已通过需求创建项目"),
  permission("button.tasks.create", "创建任务", "button", "创建项目任务"),
  permission("button.tasks.update", "更新任务", "button", "维护任务状态和负责人"),
  permission("button.tasks.block", "标记阻塞", "button", "标记任务阻塞"),
  permission("button.meetings.create", "创建会议", "button", "创建会议纪要"),
  permission("button.risks.create", "创建风险", "button", "登记项目风险"),
  permission("button.changes.create", "创建变更", "button", "发起变更申请"),
  permission("button.defects.create", "创建bug单", "button", "登记测试和上线过程中的bug"),
  permission("button.defects.edit", "编辑bug单", "button", "维护bug单"),
  permission("button.releases.approve", "上线审批", "button", "执行上线审批"),
  permission("button.people.create", "创建职能账号", "button", "创建本职能账号"),
  permission("button.people.delete", "删除职能账号", "button", "删除本职能账号"),
  permission("button.people.promoteLeader", "设为负责人", "button", "将职能成员设为负责人"),
  permission("button.people.demoteLeader", "移除负责人", "button", "移除职能成员负责人身份"),
  permission("button.admin.managePermissions", "维护权限", "button", "维护角色和权限配置")
];

const fieldPermissions = [
  permission("field.reserved", "字段权限预留", "field", "Day 1 仅预留字段权限结构")
];

const baseReadPermissions = [
  "menu.dashboard.view",
  "menu.profile.view",
  "menu.requirements.view",
  "menu.reviews.view",
  "menu.defects.view",
  "menu.notifications.view",
  "menu.people.manage",
  "api.requirements.read",
  "api.requirements.create",
  "api.projects.read",
  "api.tasks.read",
  "api.defects.read",
  "api.defects.create",
  "api.defects.update",
  "api.reviews.read",
  "api.workflowTemplates.read",
  "api.users.read",
  "api.departments.read",
  "api.permissions.summary.read",
  "button.requirements.create",
  "button.defects.create",
  "button.defects.edit",
  "field.reserved"
];

const allPermissionCodes = [
  ...menuPermissions,
  ...apiPermissions,
  ...buttonPermissions,
  ...fieldPermissions
].map((item) => item.code);

function role(
  id: string,
  code: string,
  name: string,
  description: string,
  permissionCodes: string[]
): Role {
  return {
    id,
    code,
    name,
    description,
    permissionCodes: Array.from(new Set(permissionCodes)),
    isSeed: true
  };
}

function seedUser(
  id: string,
  username: string,
  displayName: string,
  email: string,
  departmentId: string,
  roleIds: string[],
  title: string
): StoredUserSeed {
  const { salt, hash } = hashPassword(DEMO_PASSWORD, `seed-${departmentId}-${username}`);

  return {
    id,
    username,
    displayName,
    email,
    departmentId,
    roleIds,
    title,
    status: "active",
    passwordSalt: salt,
    passwordHash: hash,
    isSeed: true
  };
}

function seedRequirement(
  index: number,
  input: Omit<
    Requirement,
    | "id"
    | "code"
    | "createdAt"
    | "updatedAt"
    | "isSeed"
    | "reviewApproverAssignments"
    | "projectMembers"
  > &
    Partial<Pick<Requirement, "reviewApproverAssignments" | "projectMembers">>
): Requirement {
  const serial = String(index).padStart(4, "0");
  const createdAt = new Date(Date.UTC(2026, 4, 10 + index, 2, index, 0)).toISOString();
  const submittedAt =
    input.status === "DRAFT"
      ? undefined
      : new Date(Date.UTC(2026, 4, 10 + index, 8, index, 0)).toISOString();

  return {
    ...input,
    id: `req_seed_${serial}`,
    code: `X${index}`,
    reviewApproverAssignments: input.reviewApproverAssignments ?? {},
    projectMembers: input.projectMembers ?? [],
    createdAt,
    updatedAt: createdAt,
    submittedAt,
    withdrawnAt:
      input.status === "WITHDRAWN"
        ? new Date(Date.UTC(2026, 4, 10 + index, 9, index, 0)).toISOString()
        : input.withdrawnAt,
    isSeed: true
  };
}

function historyForRequirement(requirement: Requirement): RequirementStatusHistory[] {
  const histories: RequirementStatusHistory[] = [
    {
      id: `hist_${requirement.id}_created`,
      entityType: "requirement",
      entityId: requirement.id,
      toStatus: "DRAFT",
      operatorId: requirement.submitterId,
      reason: "创建需求草稿",
      createdAt: requirement.createdAt,
      isSeed: true
    }
  ];

  if (requirement.status !== "DRAFT") {
    histories.push({
      id: `hist_${requirement.id}_${requirement.status.toLowerCase()}`,
      entityType: "requirement",
      entityId: requirement.id,
      fromStatus: "DRAFT",
      toStatus: requirement.status,
      operatorId: requirement.submitterId,
      reason: requirement.status === "WITHDRAWN" ? "演示数据：撤回需求" : "演示数据：状态流转",
      createdAt: requirement.submittedAt ?? requirement.updatedAt,
      isSeed: true
    });
  }

  return histories;
}

function seedReviewFlow(
  requirement: Requirement,
  status: ReviewFlowStatus,
  startedBy = requirement.submitterId
): ReviewFlow {
  const completedStatuses: ReviewFlowStatus[] = ["APPROVED", "REJECTED", "NEEDS_SUPPLEMENT", "CANCELED"];

  return {
    id: `flow_${requirement.id}`,
    requirementId: requirement.id,
    templateId: "template_requirement_default",
    status,
    startedBy,
    startedAt: requirement.submittedAt ?? requirement.createdAt,
    completedAt: completedStatuses.includes(status)
      ? new Date(new Date(requirement.submittedAt ?? requirement.createdAt).getTime() + 3 * 60 * 60 * 1000).toISOString()
      : undefined,
    isSeed: true
  };
}

function seedReviewNode(
  flow: ReviewFlow,
  orderIndex: number,
  nodeName: string,
  nodeType: ReviewNode["nodeType"],
  approverId: string,
  status: ReviewNodeStatus,
  comment?: string
): ReviewNode {
  const startedAt = new Date(flow.startedAt).getTime();
  const handledStatuses: ReviewNodeStatus[] = [
    "APPROVED",
    "REJECTED",
    "NEEDS_SUPPLEMENT",
    "TRANSFERRED",
    "SKIPPED"
  ];

  return {
    id: `node_${flow.requirementId}_${orderIndex}`,
    flowId: flow.id,
    nodeName,
    nodeType,
    approverId,
    status,
    comment,
    orderIndex,
    dueAt: new Date(startedAt + (orderIndex + 1) * 24 * 60 * 60 * 1000).toISOString(),
    handledAt: handledStatuses.includes(status)
      ? new Date(startedAt + (orderIndex + 1) * 50 * 60 * 1000).toISOString()
      : undefined,
    required: true,
    isSeed: true
  };
}

function defaultReviewNodes(flow: ReviewFlow, statuses: ReviewNodeStatus[]) {
  const config = [
    ["产品评审", "PRODUCT", "user_product_assistant", "产品方案已确认。"],
    ["技术评审", "TECH", "user_tech_lead", "技术方案可行。"],
    ["测试评审", "TEST", "user_qa", "测试范围已确认。"],
    ["运营/相关方确认", "OPERATION", "user_ops_service", "运营影响已确认。"]
  ] as const;

  return config.map(([nodeName, nodeType, approverId, comment], index) =>
    seedReviewNode(
      flow,
      index,
      nodeName,
      nodeType,
      approverId,
      statuses[index] ?? "PENDING",
      statuses[index] === "APPROVED" ? comment : statuses[index] === "REJECTED" ? "演示数据：评审不通过。" : statuses[index] === "NEEDS_SUPPLEMENT" ? "演示数据：需要补充上线影响说明。" : undefined
    )
  );
}

function seedProject(
  index: number,
  input: Omit<Project, "id" | "code" | "createdAt" | "updatedAt" | "isSeed">
): Project {
  const serial = String(index).padStart(4, "0");
  const createdAt = new Date(Date.UTC(2026, 4, 17 + index, 1, index, 0)).toISOString();

  return {
    ...input,
    id: `proj_seed_${serial}`,
    code: `P${index}`,
    createdAt,
    updatedAt: createdAt,
    isSeed: true
  };
}

function seedTask(
  index: number,
  input: Omit<Task, "id" | "code" | "createdAt" | "updatedAt" | "isSeed">
): Task {
  const serial = String(index).padStart(4, "0");
  const createdAt = new Date(Date.UTC(2026, 4, 18 + Math.floor(index / 3), 2, index, 0)).toISOString();

  return {
    ...input,
    id: `task_seed_${serial}`,
    code: `TASK-${serial}`,
    createdAt,
    updatedAt: createdAt,
    isSeed: true
  };
}

function seedBugTicket(
  index: number,
  input: Omit<BugTicket, "id" | "code" | "createdAt" | "updatedAt" | "isSeed">
): BugTicket {
  const serial = String(index).padStart(4, "0");
  const createdAt = new Date(Date.UTC(2026, 4, 19 + index, 4, index, 0)).toISOString();

  return {
    ...input,
    id: `bug_seed_${serial}`,
    code: `BUG-${serial}`,
    createdAt,
    updatedAt: createdAt,
    isSeed: true
  };
}

function historyForTask(task: Task): TaskStatusHistory[] {
  const histories: TaskStatusHistory[] = [
    {
      id: `task_hist_${task.id}_created`,
      taskId: task.id,
      toStatus: "TODO",
      operatorId: task.createdBy,
      reason: "创建项目任务",
      createdAt: task.createdAt,
      isSeed: true
    }
  ];

  if (task.status !== "TODO") {
    histories.push({
      id: `task_hist_${task.id}_${task.status.toLowerCase()}`,
      taskId: task.id,
      fromStatus: "TODO",
      toStatus: task.status,
      operatorId: task.assigneeId,
      reason: task.status === "BLOCKED" ? task.blockerReason ?? "演示数据：任务阻塞" : "演示数据：任务状态流转",
      createdAt: task.updatedAt,
      isSeed: true
    });
  }

  return histories;
}

export function buildDemoData(): DemoData {
  const departments: Department[] = [
    {
      id: "dept_platform",
      code: "platform",
      name: "平台研发部",
      description: "负责协同工具平台、架构和基础能力建设",
      leaderUserIds: ["user_tech_lead"],
      isSeed: true
    },
    {
      id: "dept_product",
      code: "product",
      name: "产品部",
      description: "负责需求管理、产品方案和验收确认",
      leaderUserIds: ["user_pm", "user_product_assistant"],
      isSeed: true
    },
    {
      id: "dept_project",
      code: "project",
      name: "项目管理部",
      description: "负责项目计划、资源协调和交付风险跟进",
      leaderUserIds: ["user_project_manager"],
      isSeed: true
    },
    {
      id: "dept_quality",
      code: "quality",
      name: "质量保障部",
      description: "负责测试、缺陷验证和上线质量把关",
      leaderUserIds: ["user_qa"],
      isSeed: true
    },
    {
      id: "dept_design",
      code: "design",
      name: "体验设计部",
      description: "负责交互、视觉和设计交付",
      leaderUserIds: ["user_designer"],
      isSeed: true
    },
    {
      id: "dept_business",
      code: "business",
      name: "运营客服部",
      description: "负责运营需求、用户反馈和上线沟通",
      leaderUserIds: ["user_ops_service", "user_ops_lead"],
      isSeed: true
    },
    {
      id: "dept_review",
      code: "review",
      name: "专项评审组",
      description: "负责法务、安全、数据等专项评审",
      leaderUserIds: ["user_special_reviewer"],
      isSeed: true
    },
    {
      id: "dept_management",
      code: "management",
      name: "管理层",
      description: "查看项目进度、风险和交付效率",
      leaderUserIds: ["user_executive"],
      isSeed: true
    }
  ];

  const permissions = [
    ...menuPermissions,
    ...apiPermissions,
    ...buttonPermissions,
    ...fieldPermissions
  ];

  const roles: Role[] = [
    role("role_admin", "admin", "系统管理员", "维护用户、角色、权限和系统配置", [
      ...allPermissionCodes
    ]),
    role("role_product_manager", "product_manager", "产品经理", "维护需求并发起评审", [
      ...baseReadPermissions,
      "api.projects.create",
      "api.projects.update",
      "api.tasks.create",
      "api.tasks.update",
      "menu.requirements.view",
      "menu.reviews.view",
      "menu.projects.view",
      "menu.tasks.view",
      "button.requirements.create",
      "button.requirements.edit",
      "button.requirements.submit",
      "button.projects.create",
      "button.tasks.create",
      "button.tasks.update",
      "button.tasks.block",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_project_manager", "project_manager", "项目经理", "管理项目计划、任务和交付风险", [
      ...baseReadPermissions,
      "api.users.read",
      "api.projects.create",
      "api.projects.update",
      "api.tasks.create",
      "api.tasks.update",
      "menu.requirements.view",
      "menu.projects.view",
      "menu.tasks.view",
      "menu.meetings.view",
      "menu.risks.view",
      "menu.changes.view",
      "menu.defects.view",
      "menu.releases.view",
      "button.projects.create",
      "button.tasks.create",
      "button.tasks.update",
      "button.tasks.block",
      "button.meetings.create",
      "button.risks.create",
      "button.changes.create",
      "button.defects.create",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_engineering_lead", "engineering_lead", "研发负责人", "参与技术评审并协调研发任务", [
      ...baseReadPermissions,
      "api.users.read",
      "api.tasks.create",
      "api.tasks.update",
      "menu.requirements.view",
      "menu.reviews.view",
      "menu.projects.view",
      "menu.tasks.view",
      "menu.defects.view",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer",
      "button.tasks.create",
      "button.tasks.update",
      "button.tasks.block"
    ]),
    role("role_developer", "developer", "开发", "执行研发任务并处理缺陷", [
      ...baseReadPermissions,
      "api.tasks.update",
      "menu.projects.view",
      "menu.tasks.view",
      "menu.defects.view",
      "button.tasks.update",
      "button.tasks.block"
    ]),
    role("role_tester", "tester", "测试", "提交缺陷并验证修复结果", [
      ...baseReadPermissions,
      "api.tasks.update",
      "menu.tasks.view",
      "menu.reviews.view",
      "menu.defects.view",
      "menu.releases.view",
      "button.defects.create",
      "button.tasks.update",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_designer", "designer", "设计", "维护设计任务和交付物", [
      ...baseReadPermissions,
      "api.tasks.update",
      "menu.requirements.view",
      "menu.reviews.view",
      "menu.tasks.view",
      "button.tasks.update",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_ops_support", "ops_support", "运营客服", "提交运营需求并跟进用户反馈", [
      ...baseReadPermissions,
      "api.tasks.update",
      "menu.requirements.view",
      "menu.tasks.view",
      "menu.releases.view",
      "button.requirements.create",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_special_reviewer", "special_reviewer", "专项评审", "参与安全、法务、数据等专项评审", [
      ...baseReadPermissions,
      "menu.requirements.view",
      "menu.reviews.view",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.reviews.requestSupplement",
      "button.reviews.transfer"
    ]),
    role("role_executive", "executive", "管理层", "只读查看全局项目进展和风险", [
      ...baseReadPermissions,
      "api.users.read",
      "menu.requirements.view",
      "menu.projects.view",
      "menu.risks.view",
      "menu.changes.view",
      "menu.releases.view"
    ])
  ];

  const users = [
    seedUser(
      "user_admin",
      "10001",
      "林一鸣",
      "admin.demo@example.com",
      "dept_platform",
      ["role_admin"],
      "系统管理员"
    ),
    seedUser(
      "user_pm",
      "10001",
      "周产品",
      "pm.demo@example.com",
      "dept_product",
      ["role_product_manager"],
      "产品经理"
    ),
    seedUser(
      "user_project_manager",
      "10001",
      "陈项目",
      "project.manager.demo@example.com",
      "dept_project",
      ["role_project_manager"],
      "项目经理"
    ),
    seedUser(
      "user_tech_lead",
      "10002",
      "赵研发",
      "tech.lead.demo@example.com",
      "dept_platform",
      ["role_engineering_lead"],
      "研发负责人"
    ),
    seedUser(
      "user_developer",
      "10003",
      "吴开发",
      "developer.demo@example.com",
      "dept_platform",
      ["role_developer"],
      "前端开发"
    ),
    seedUser(
      "user_backend_developer",
      "10004",
      "马后端",
      "backend.dev.demo@example.com",
      "dept_platform",
      ["role_developer"],
      "后端开发"
    ),
    seedUser(
      "user_product_assistant",
      "10002",
      "许产品",
      "product.assistant.demo@example.com",
      "dept_product",
      ["role_product_manager"],
      "产品助理"
    ),
    seedUser(
      "user_qa",
      "10001",
      "孙测试",
      "qa.demo@example.com",
      "dept_quality",
      ["role_tester"],
      "测试工程师"
    ),
    seedUser(
      "user_designer",
      "10001",
      "郑设计",
      "designer.demo@example.com",
      "dept_design",
      ["role_designer"],
      "体验设计师"
    ),
    seedUser(
      "user_ops_service",
      "10001",
      "王运营",
      "ops.service.demo@example.com",
      "dept_business",
      ["role_ops_support"],
      "运营客服"
    ),
    seedUser(
      "user_ops_lead",
      "10002",
      "冯运营",
      "ops.lead.demo@example.com",
      "dept_business",
      ["role_ops_support"],
      "运营负责人"
    ),
    seedUser(
      "user_special_reviewer",
      "10001",
      "钱评审",
      "special.reviewer.demo@example.com",
      "dept_review",
      ["role_special_reviewer"],
      "专项评审"
    ),
    seedUser(
      "user_executive",
      "10001",
      "李管理",
      "executive.demo@example.com",
      "dept_management",
      ["role_executive"],
      "管理层"
    )
  ];

  const notifications: Notification[] = users.map((user, index) => ({
    id: `notice_seed_${index + 1}`,
    userId: user.id,
    title: "Day 1 演示账号已就绪",
    content: "认证、权限摘要和菜单过滤已启用，可继续推进需求池模块。",
    type: "system",
    read: index % 3 === 0,
    createdAt: new Date(Date.UTC(2026, 4, 17, 3, index, 0)).toISOString(),
    isSeed: true
  }));

  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: "template_requirement_default",
      name: "默认需求评审流程",
      description: "产品评审 → 技术评审 → 测试评审 → 运营/相关方确认",
      appliesTo: "REQUIREMENT",
      isDefault: true,
      enabled: true,
      nodesConfig: [
        {
          nodeName: "产品评审",
          nodeType: "PRODUCT",
          defaultApproverUserId: "user_product_assistant",
          defaultRoleCode: "product_manager",
          defaultDepartmentId: "dept_product",
          required: true,
          orderIndex: 0,
          dueInHours: 24
        },
        {
          nodeName: "技术评审",
          nodeType: "TECH",
          defaultApproverUserId: "user_tech_lead",
          defaultRoleCode: "engineering_lead",
          defaultDepartmentId: "dept_platform",
          required: true,
          orderIndex: 1,
          dueInHours: 24
        },
        {
          nodeName: "测试评审",
          nodeType: "TEST",
          defaultApproverUserId: "user_qa",
          defaultRoleCode: "tester",
          defaultDepartmentId: "dept_quality",
          required: true,
          orderIndex: 2,
          dueInHours: 24
        },
        {
          nodeName: "运营/相关方确认",
          nodeType: "OPERATION",
          defaultApproverUserId: "user_ops_service",
          defaultRoleCode: "ops_support",
          defaultDepartmentId: "dept_business",
          required: true,
          orderIndex: 3,
          dueInHours: 24
        }
      ],
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
      isSeed: true
    }
  ];

  const requirements: Requirement[] = [
    seedRequirement(1, {
      title: "统一需求池入口",
      description: "将产品、运营、客服反馈统一收敛到需求池，减少线下表格和群消息遗漏。",
      background: "当前需求来源分散，跨部门补字段成本高，评审前经常缺少背景和目标。",
      goal: "建立统一需求入口，支持草稿、提交评审和状态追踪。",
      source: "PRODUCT",
      type: "FEATURE",
      priority: "P1",
      status: "IN_REVIEW",
      departmentId: "dept_product",
      ownerId: "user_pm",
      submitterId: "user_pm",
      expectedReleaseDate: "2026-06-05",
      relatedDepartments: ["dept_platform", "dept_project", "dept_quality"],
      impactScope: "影响产品、项目、研发和测试的需求协作流程。",
      successMetric: "80% 新需求通过需求池提交，评审前补充字段次数下降 50%。",
      attachments: [{ name: "需求池字段草案", url: "https://example.com/demo/requirements-fields" }]
    }),
    seedRequirement(2, {
      title: "客服高频反馈自动归类",
      description: "把客服侧高频问题沉淀为可筛选需求，帮助产品快速识别重复诉求。",
      background: "运营客服部每天从多个渠道收集反馈，重复问题需要人工合并。",
      goal: "支持按反馈主题聚合，并生成需求草稿。",
      source: "CS",
      type: "OPTIMIZATION",
      priority: "P2",
      status: "DRAFT",
      departmentId: "dept_business",
      ownerId: "user_product_assistant",
      submitterId: "user_ops_service",
      expectedReleaseDate: "2026-06-20",
      relatedDepartments: ["dept_product", "dept_platform"],
      impactScope: "影响客服反馈整理和产品需求分析。",
      successMetric: "客服重复反馈整理耗时降低 30%。",
      attachments: []
    }),
    seedRequirement(3, {
      title: "P0 线上阻断缺陷修复",
      description: "修复部分用户提交资料后无法进入下一步的问题。",
      background: "客户反馈资料提交页偶现卡住，影响关键交易链路。",
      goal: "恢复资料提交链路稳定性并补充监控。",
      source: "CUSTOMER",
      type: "BUGFIX",
      priority: "P0",
      status: "IN_REVIEW",
      departmentId: "dept_business",
      ownerId: "user_pm",
      submitterId: "user_ops_service",
      expectedReleaseDate: "2026-05-25",
      relatedDepartments: ["dept_platform", "dept_quality"],
      impactScope: "影响客户提交资料主流程，可能导致转化损失。",
      successMetric: "相关错误率恢复到 0.1% 以下。",
      attachments: [{ name: "客户反馈截图", url: "https://example.com/demo/customer-feedback" }]
    }),
    seedRequirement(4, {
      title: "数据报表口径统一",
      description: "统一需求看板中提交量、评审通过率、交付周期等指标口径。",
      background: "不同部门对指标口径理解不一致，复盘时需要重复对数。",
      goal: "输出统一指标字段和计算逻辑。",
      source: "DATA",
      type: "DATA",
      priority: "P1",
      status: "APPROVED",
      projectId: "proj_seed_0001",
      departmentId: "dept_management",
      ownerId: "user_pm",
      submitterId: "user_executive",
      expectedReleaseDate: "2026-06-15",
      relatedDepartments: ["dept_product", "dept_project", "dept_review"],
      impactScope: "影响管理层看板、项目复盘和跨部门指标对齐。",
      successMetric: "核心指标解释口径在各部门周会中一致使用。",
      attachments: []
    }),
    seedRequirement(5, {
      title: "上线 checklist 合规项补充",
      description: "上线前必须确认隐私、日志留存和敏感配置扫描结果。",
      background: "专项评审发现上线 checklist 中缺少部分合规确认项。",
      goal: "在上线流程中补齐法务、安全、数据相关检查项。",
      source: "OTHER",
      type: "COMPLIANCE",
      priority: "P1",
      status: "NEEDS_SUPPLEMENT",
      departmentId: "dept_review",
      ownerId: "user_pm",
      submitterId: "user_special_reviewer",
      expectedReleaseDate: "2026-06-10",
      relatedDepartments: ["dept_review", "dept_platform", "dept_quality"],
      impactScope: "影响所有需要上线审批的项目。",
      successMetric: "上线前合规检查项遗漏率降至 0。",
      attachments: [{ name: "专项评审补充项", url: "https://example.com/demo/review-checklist" }]
    }),
    seedRequirement(6, {
      title: "活动报名页性能优化",
      description: "优化活动报名页首屏加载和图片资源策略。",
      background: "运营活动期间页面访问量上升，首屏加载偏慢影响报名转化。",
      goal: "将首屏加载时间降低到 2 秒以内。",
      source: "OPERATION",
      type: "ACTIVITY",
      priority: "P2",
      status: "APPROVED",
      projectId: "proj_seed_0002",
      departmentId: "dept_business",
      ownerId: "user_product_assistant",
      submitterId: "user_ops_service",
      expectedReleaseDate: "2026-06-01",
      relatedDepartments: ["dept_platform", "dept_design"],
      impactScope: "影响活动页报名转化。",
      successMetric: "活动页首屏加载 P75 小于 2 秒。",
      attachments: []
    }),
    seedRequirement(7, {
      title: "项目风险红黄灯规则",
      description: "为项目空间增加风险红黄灯判定规则，便于项目经理提前预警。",
      background: "当前风险多靠会议口头同步，缺少统一可视化规则。",
      goal: "按延期、阻塞、缺陷、变更数量生成风险等级。",
      source: "PRODUCT",
      type: "FEATURE",
      priority: "P2",
      status: "IN_REVIEW",
      projectId: "proj_seed_0003",
      departmentId: "dept_project",
      ownerId: "user_project_manager",
      submitterId: "user_project_manager",
      expectedReleaseDate: "2026-07-01",
      relatedDepartments: ["dept_project", "dept_platform", "dept_quality"],
      impactScope: "影响项目经理、研发负责人和管理层查看项目健康度。",
      successMetric: "项目风险提前识别率提升 40%。",
      attachments: []
    }),
    seedRequirement(8, {
      title: "设计走查问题沉淀",
      description: "将设计走查问题沉淀到需求或任务中，避免上线前重复遗漏。",
      background: "设计走查意见散落在会议纪要和聊天记录中，闭环追踪弱。",
      goal: "支持设计走查项与需求关联。",
      source: "PRODUCT",
      type: "OPTIMIZATION",
      priority: "P3",
      status: "REJECTED",
      departmentId: "dept_design",
      ownerId: "user_pm",
      submitterId: "user_designer",
      expectedReleaseDate: "2026-06-28",
      relatedDepartments: ["dept_product", "dept_design", "dept_platform"],
      impactScope: "影响设计验收和上线前体验问题跟踪。",
      successMetric: "设计走查问题闭环率提升 50%。",
      attachments: []
    })
  ];

  const requirementStatusHistories = requirements.flatMap(historyForRequirement);
  const reviewFlows: ReviewFlow[] = [
    seedReviewFlow(requirements[0], "IN_PROGRESS"),
    seedReviewFlow(requirements[2], "IN_PROGRESS"),
    seedReviewFlow(requirements[3], "APPROVED"),
    seedReviewFlow(requirements[4], "NEEDS_SUPPLEMENT"),
    seedReviewFlow(requirements[5], "APPROVED"),
    seedReviewFlow(requirements[6], "IN_PROGRESS"),
    seedReviewFlow(requirements[7], "REJECTED")
  ];
  const reviewNodes: ReviewNode[] = [
    ...defaultReviewNodes(reviewFlows[0], ["APPROVED", "IN_PROGRESS", "PENDING", "PENDING"]),
    ...defaultReviewNodes(reviewFlows[1], ["APPROVED", "APPROVED", "IN_PROGRESS", "PENDING"]),
    ...defaultReviewNodes(reviewFlows[2], ["APPROVED", "APPROVED", "APPROVED", "APPROVED"]),
    ...defaultReviewNodes(reviewFlows[3], ["NEEDS_SUPPLEMENT", "SKIPPED", "SKIPPED", "SKIPPED"]),
    ...defaultReviewNodes(reviewFlows[4], ["APPROVED", "APPROVED", "APPROVED", "APPROVED"]),
    ...defaultReviewNodes(reviewFlows[5], ["IN_PROGRESS", "PENDING", "PENDING", "PENDING"]),
    ...defaultReviewNodes(reviewFlows[6], ["APPROVED", "REJECTED", "SKIPPED", "SKIPPED"])
  ];
  const projects: Project[] = [
    seedProject(1, {
      name: "数据指标统一交付项目",
      requirementId: "req_seed_0004",
      description: "围绕管理看板和需求池指标口径统一完成数据链路、展示和验收。",
      ownerId: "user_project_manager",
      status: "IN_PROGRESS",
      participantDepartmentIds: ["dept_product", "dept_project", "dept_platform", "dept_quality", "dept_review"],
      plannedStartDate: "2026-05-20",
      plannedEndDate: "2026-06-12",
      plannedReleaseDate: "2026-06-15",
      createdBy: "user_project_manager"
    }),
    seedProject(2, {
      name: "活动报名页性能优化项目",
      requirementId: "req_seed_0006",
      description: "优化报名页资源策略、首屏加载和测试验收，支撑六月运营活动。",
      ownerId: "user_product_assistant",
      status: "BLOCKED",
      participantDepartmentIds: ["dept_business", "dept_product", "dept_platform", "dept_design", "dept_quality"],
      plannedStartDate: "2026-05-19",
      plannedEndDate: "2026-05-31",
      plannedReleaseDate: "2026-06-01",
      createdBy: "user_product_assistant"
    }),
    seedProject(3, {
      name: "风险红黄灯规则预研项目",
      requirementId: "req_seed_0007",
      description: "提前拆解风险判定、任务看板和项目健康度展示，为后续正式立项准备。",
      ownerId: "user_project_manager",
      status: "PLANNING",
      participantDepartmentIds: ["dept_project", "dept_platform", "dept_quality", "dept_management"],
      plannedStartDate: "2026-06-03",
      plannedEndDate: "2026-06-28",
      plannedReleaseDate: "2026-07-01",
      createdBy: "user_project_manager"
    })
  ];
  const tasks: Task[] = [
    seedTask(1, {
      projectId: "proj_seed_0001",
      requirementId: "req_seed_0004",
      title: "梳理指标口径与字段字典",
      description: "输出提交量、通过率、交付周期等核心指标定义。",
      taskType: "PRODUCT",
      status: "DONE",
      priority: "P1",
      assigneeId: "user_pm",
      departmentId: "dept_product",
      startDate: "2026-05-20",
      dueDate: "2026-05-22",
      completedAt: "2026-05-22T09:20:00.000Z",
      dependencyTaskIds: [],
      createdBy: "user_project_manager"
    }),
    seedTask(2, {
      projectId: "proj_seed_0001",
      requirementId: "req_seed_0004",
      title: "实现指标聚合接口",
      description: "按统一口径提供项目和需求看板聚合数据。",
      taskType: "BACKEND",
      status: "IN_PROGRESS",
      priority: "P1",
      assigneeId: "user_backend_developer",
      departmentId: "dept_platform",
      startDate: "2026-05-23",
      dueDate: "2026-05-28",
      dependencyTaskIds: ["task_seed_0001"],
      createdBy: "user_project_manager"
    }),
    seedTask(3, {
      projectId: "proj_seed_0001",
      requirementId: "req_seed_0004",
      title: "管理看板指标展示",
      description: "接入指标接口并完成管理层看板展示。",
      taskType: "FRONTEND",
      status: "TODO",
      priority: "P2",
      assigneeId: "user_developer",
      departmentId: "dept_platform",
      startDate: "2026-05-27",
      dueDate: "2026-06-02",
      dependencyTaskIds: ["task_seed_0002"],
      createdBy: "user_project_manager"
    }),
    seedTask(4, {
      projectId: "proj_seed_0001",
      requirementId: "req_seed_0004",
      title: "补充数据验收用例",
      description: "覆盖指标边界、空数据和跨部门筛选。",
      taskType: "TEST",
      status: "BLOCKED",
      priority: "P1",
      assigneeId: "user_qa",
      departmentId: "dept_quality",
      startDate: "2026-05-26",
      dueDate: "2026-05-30",
      blockerReason: "等待后端指标接口字段确认",
      dependencyTaskIds: ["task_seed_0002"],
      createdBy: "user_project_manager"
    }),
    seedTask(5, {
      projectId: "proj_seed_0001",
      requirementId: "req_seed_0004",
      title: "专项口径复核",
      description: "确认数据指标是否涉及专项合规披露。",
      taskType: "DATA",
      status: "CANCELED",
      priority: "P3",
      assigneeId: "user_special_reviewer",
      departmentId: "dept_review",
      dueDate: "2026-05-29",
      dependencyTaskIds: [],
      createdBy: "user_project_manager"
    }),
    seedTask(6, {
      projectId: "proj_seed_0002",
      requirementId: "req_seed_0006",
      title: "活动页性能问题定位",
      description: "定位首屏资源、接口和图片策略中的主要耗时来源。",
      taskType: "FRONTEND",
      status: "DONE",
      priority: "P2",
      assigneeId: "user_developer",
      departmentId: "dept_platform",
      startDate: "2026-05-19",
      dueDate: "2026-05-20",
      completedAt: "2026-05-20T10:00:00.000Z",
      dependencyTaskIds: [],
      createdBy: "user_product_assistant"
    }),
    seedTask(7, {
      projectId: "proj_seed_0002",
      requirementId: "req_seed_0006",
      title: "图片裁切与资源压缩",
      description: "输出运营活动页图片规格并压缩首屏素材。",
      taskType: "DESIGN",
      status: "IN_PROGRESS",
      priority: "P2",
      assigneeId: "user_designer",
      departmentId: "dept_design",
      startDate: "2026-05-20",
      dueDate: "2026-05-24",
      dependencyTaskIds: ["task_seed_0006"],
      createdBy: "user_product_assistant"
    }),
    seedTask(8, {
      projectId: "proj_seed_0002",
      requirementId: "req_seed_0006",
      title: "报名接口缓存策略",
      description: "为活动报名接口增加缓存和限流保护。",
      taskType: "BACKEND",
      status: "BLOCKED",
      priority: "P1",
      assigneeId: "user_backend_developer",
      departmentId: "dept_platform",
      startDate: "2026-05-21",
      dueDate: "2026-05-25",
      blockerReason: "等待运营确认活动峰值流量预估",
      dependencyTaskIds: [],
      createdBy: "user_product_assistant"
    }),
    seedTask(9, {
      projectId: "proj_seed_0002",
      requirementId: "req_seed_0006",
      title: "性能回归测试",
      description: "压测首屏加载和报名链路稳定性。",
      taskType: "TEST",
      status: "TODO",
      priority: "P2",
      assigneeId: "user_qa",
      departmentId: "dept_quality",
      startDate: "2026-05-26",
      dueDate: "2026-05-29",
      dependencyTaskIds: ["task_seed_0007", "task_seed_0008"],
      createdBy: "user_product_assistant"
    }),
    seedTask(10, {
      projectId: "proj_seed_0002",
      requirementId: "req_seed_0006",
      title: "上线运营沟通",
      description: "同步活动方上线窗口和回滚联系人。",
      taskType: "OPERATION",
      status: "TODO",
      priority: "P3",
      assigneeId: "user_ops_service",
      departmentId: "dept_business",
      dueDate: "2026-05-30",
      dependencyTaskIds: [],
      createdBy: "user_product_assistant"
    }),
    seedTask(11, {
      projectId: "proj_seed_0003",
      requirementId: "req_seed_0007",
      title: "风险等级规则草案",
      description: "整理延期、阻塞、缺陷、变更维度的风险等级规则。",
      taskType: "PRODUCT",
      status: "TODO",
      priority: "P2",
      assigneeId: "user_project_manager",
      departmentId: "dept_project",
      dueDate: "2026-06-07",
      dependencyTaskIds: [],
      createdBy: "user_project_manager"
    }),
    seedTask(12, {
      projectId: "proj_seed_0003",
      requirementId: "req_seed_0007",
      title: "看板状态数据预研",
      description: "评估项目、任务、风险数据聚合方式。",
      taskType: "BACKEND",
      status: "TODO",
      priority: "P2",
      assigneeId: "user_backend_developer",
      departmentId: "dept_platform",
      dueDate: "2026-06-12",
      dependencyTaskIds: ["task_seed_0011"],
      createdBy: "user_project_manager"
    }),
    seedTask(13, {
      projectId: "proj_seed_0003",
      requirementId: "req_seed_0007",
      title: "红黄灯视觉方案",
      description: "设计风险标识、项目卡片和管理层视图。",
      taskType: "DESIGN",
      status: "TODO",
      priority: "P3",
      assigneeId: "user_designer",
      departmentId: "dept_design",
      dueDate: "2026-06-14",
      dependencyTaskIds: [],
      createdBy: "user_project_manager"
    }),
    seedTask(14, {
      projectId: "proj_seed_0003",
      requirementId: "req_seed_0007",
      title: "测试场景清单",
      description: "准备不同风险等级下的测试数据和验收场景。",
      taskType: "TEST",
      status: "TODO",
      priority: "P3",
      assigneeId: "user_qa",
      departmentId: "dept_quality",
      dueDate: "2026-06-18",
      dependencyTaskIds: ["task_seed_0012"],
      createdBy: "user_project_manager"
    }),
    seedTask(15, {
      projectId: "proj_seed_0003",
      requirementId: "req_seed_0007",
      title: "管理层口径确认",
      description: "确认红黄灯风险等级是否满足管理层周会使用。",
      taskType: "OTHER",
      status: "TODO",
      priority: "P2",
      assigneeId: "user_executive",
      departmentId: "dept_management",
      dueDate: "2026-06-20",
      dependencyTaskIds: ["task_seed_0011"],
      createdBy: "user_project_manager"
    })
  ];
  const bugTickets: BugTicket[] = [
    seedBugTicket(1, {
      title: "管理看板筛选后统计数量未同步刷新",
      severity: "S2",
      priority: "P1",
      status: "FIXING",
      requirementId: "req_seed_0004",
      projectId: "proj_seed_0001",
      finderId: "user_qa",
      handlerId: "user_backend_developer",
      relatedUserIds: ["user_pm", "user_project_manager"],
      description: "测试环境中切换部门筛选后，列表数据已变化，但顶部统计仍显示上一次结果。",
      createdBy: "user_qa"
    }),
    seedBugTicket(2, {
      title: "活动报名页移动端按钮遮挡底部提示",
      severity: "S3",
      priority: "P2",
      status: "PENDING_TEST",
      requirementId: "req_seed_0006",
      projectId: "proj_seed_0002",
      finderId: "user_ops_service",
      handlerId: "user_developer",
      relatedUserIds: ["user_designer", "user_qa"],
      description: "iPhone 13 viewport 下提交按钮固定到底部后遮挡错误提示，需要调整安全区域和滚动留白。",
      createdBy: "user_ops_service"
    }),
    seedBugTicket(3, {
      title: "风险规则预研项目任务状态归档后仍出现在待办",
      severity: "S4",
      priority: "P3",
      status: "CREATED",
      requirementId: "req_seed_0007",
      projectId: "proj_seed_0003",
      finderId: "user_project_manager",
      handlerId: "user_developer",
      relatedUserIds: ["user_qa"],
      description: "归档状态的任务不应继续进入个人待办列表。",
      createdBy: "user_project_manager"
    })
  ];
  const taskStatusHistories = tasks.flatMap(historyForTask);

  return {
    departments,
    permissions,
    roles,
    users,
    requirements,
    requirementStatusHistories,
    projects,
    tasks,
    taskStatusHistories,
    bugTickets,
    reviewFlows,
    reviewNodes,
    workflowTemplates,
    auditLogs: [],
    notifications
  };
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const data = buildDemoData();
  console.log(
    `Demo seed loaded: ${data.users.length} users, ${data.roles.length} roles, ${data.requirements.length} requirements, ${data.reviewFlows.length} review flows.`
  );
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
  console.table(
    data.users.map((user) => ({
      employeeNo: user.username,
      email: user.email,
      title: user.title
    }))
  );
}
