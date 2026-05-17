import type { AuditLog, Department, Notification, Permission, Role, User } from "@collab/shared";
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
  permission("menu.requirements.view", "查看需求池", "menu", "访问需求池菜单"),
  permission("menu.reviews.view", "查看评审审批", "menu", "访问评审审批菜单"),
  permission("menu.projects.view", "查看项目空间", "menu", "访问项目空间菜单"),
  permission("menu.tasks.view", "查看任务看板", "menu", "访问任务看板菜单"),
  permission("menu.meetings.view", "查看会议纪要", "menu", "访问会议纪要菜单"),
  permission("menu.risks.view", "查看风险台账", "menu", "访问风险台账菜单"),
  permission("menu.changes.view", "查看变更申请", "menu", "访问变更申请菜单"),
  permission("menu.defects.view", "查看缺陷处理", "menu", "访问缺陷处理菜单"),
  permission("menu.releases.view", "查看上线计划", "menu", "访问上线计划菜单"),
  permission("menu.notifications.view", "查看消息中心", "menu", "访问消息中心菜单"),
  permission("menu.people.manage", "管理职能成员", "menu", "访问职能成员管理菜单"),
  permission("menu.admin.view", "查看权限配置", "menu", "访问权限配置菜单")
];

const apiPermissions = [
  permission("api.users.read", "查询用户", "api", "读取用户列表"),
  permission("api.users.create", "创建用户", "api", "创建职能账号"),
  permission("api.users.delete", "删除用户", "api", "删除职能账号"),
  permission("api.departments.read", "查询部门", "api", "读取部门列表"),
  permission("api.departments.leader.update", "任命职能负责人", "api", "更新职能负责人"),
  permission("api.permissions.summary.read", "查询权限摘要", "api", "读取当前用户权限摘要")
];

const buttonPermissions = [
  permission("button.requirements.create", "创建需求", "button", "在需求池创建需求"),
  permission("button.requirements.edit", "编辑需求", "button", "编辑需求草稿或待补充需求"),
  permission("button.requirements.submit", "提交评审", "button", "提交需求进入评审"),
  permission("button.reviews.approve", "评审通过", "button", "通过评审节点"),
  permission("button.reviews.reject", "评审驳回", "button", "驳回评审节点"),
  permission("button.projects.create", "创建项目", "button", "从已通过需求创建项目"),
  permission("button.tasks.create", "创建任务", "button", "创建项目任务"),
  permission("button.tasks.update", "更新任务", "button", "维护任务状态和负责人"),
  permission("button.tasks.block", "标记阻塞", "button", "标记任务阻塞"),
  permission("button.meetings.create", "创建会议", "button", "创建会议纪要"),
  permission("button.risks.create", "创建风险", "button", "登记项目风险"),
  permission("button.changes.create", "创建变更", "button", "发起变更申请"),
  permission("button.defects.create", "创建缺陷", "button", "登记缺陷"),
  permission("button.releases.approve", "上线审批", "button", "执行上线审批"),
  permission("button.people.create", "创建职能账号", "button", "创建本职能账号"),
  permission("button.people.delete", "删除职能账号", "button", "删除本职能账号"),
  permission("button.people.promoteLeader", "设为负责人", "button", "将职能成员设为负责人"),
  permission("button.admin.managePermissions", "维护权限", "button", "维护角色和权限配置")
];

const fieldPermissions = [
  permission("field.reserved", "字段权限预留", "field", "Day 1 仅预留字段权限结构")
];

const baseReadPermissions = [
  "menu.dashboard.view",
  "menu.notifications.view",
  "api.departments.read",
  "api.permissions.summary.read",
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

export function buildDemoData(): DemoData {
  const departments: Department[] = [
    {
      id: "dept_platform",
      code: "platform",
      name: "平台研发部",
      description: "负责协同工具平台、架构和基础能力建设",
      leaderUserId: "user_tech_lead",
      isSeed: true
    },
    {
      id: "dept_product",
      code: "product",
      name: "产品部",
      description: "负责需求管理、产品方案和验收确认",
      leaderUserId: "user_pm",
      isSeed: true
    },
    {
      id: "dept_project",
      code: "project",
      name: "项目管理部",
      description: "负责项目计划、资源协调和交付风险跟进",
      leaderUserId: "user_project_manager",
      isSeed: true
    },
    {
      id: "dept_quality",
      code: "quality",
      name: "质量保障部",
      description: "负责测试、缺陷验证和上线质量把关",
      leaderUserId: "user_qa",
      isSeed: true
    },
    {
      id: "dept_design",
      code: "design",
      name: "体验设计部",
      description: "负责交互、视觉和设计交付",
      leaderUserId: "user_designer",
      isSeed: true
    },
    {
      id: "dept_business",
      code: "business",
      name: "运营客服部",
      description: "负责运营需求、用户反馈和上线沟通",
      leaderUserId: "user_ops_service",
      isSeed: true
    },
    {
      id: "dept_review",
      code: "review",
      name: "专项评审组",
      description: "负责法务、安全、数据等专项评审",
      leaderUserId: "user_special_reviewer",
      isSeed: true
    },
    {
      id: "dept_management",
      code: "management",
      name: "管理层",
      description: "查看项目进度、风险和交付效率",
      leaderUserId: "user_executive",
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
      "menu.requirements.view",
      "menu.reviews.view",
      "button.requirements.create",
      "button.requirements.edit",
      "button.requirements.submit"
    ]),
    role("role_project_manager", "project_manager", "项目经理", "管理项目计划、任务和交付风险", [
      ...baseReadPermissions,
      "api.users.read",
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
      "button.defects.create"
    ]),
    role("role_engineering_lead", "engineering_lead", "研发负责人", "参与技术评审并协调研发任务", [
      ...baseReadPermissions,
      "api.users.read",
      "menu.requirements.view",
      "menu.reviews.view",
      "menu.projects.view",
      "menu.tasks.view",
      "menu.defects.view",
      "button.reviews.approve",
      "button.reviews.reject",
      "button.tasks.create",
      "button.tasks.update",
      "button.tasks.block"
    ]),
    role("role_developer", "developer", "开发", "执行研发任务并处理缺陷", [
      ...baseReadPermissions,
      "menu.projects.view",
      "menu.tasks.view",
      "menu.defects.view",
      "button.tasks.update",
      "button.tasks.block"
    ]),
    role("role_tester", "tester", "测试", "提交缺陷并验证修复结果", [
      ...baseReadPermissions,
      "menu.tasks.view",
      "menu.defects.view",
      "menu.releases.view",
      "button.defects.create",
      "button.tasks.update"
    ]),
    role("role_designer", "designer", "设计", "维护设计任务和交付物", [
      ...baseReadPermissions,
      "menu.requirements.view",
      "menu.tasks.view",
      "button.tasks.update"
    ]),
    role("role_ops_support", "ops_support", "运营客服", "提交运营需求并跟进用户反馈", [
      ...baseReadPermissions,
      "menu.requirements.view",
      "menu.releases.view",
      "button.requirements.create"
    ]),
    role("role_special_reviewer", "special_reviewer", "专项评审", "参与安全、法务、数据等专项评审", [
      ...baseReadPermissions,
      "menu.requirements.view",
      "menu.reviews.view",
      "button.reviews.approve",
      "button.reviews.reject"
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

  return {
    departments,
    permissions,
    roles,
    users,
    auditLogs: [],
    notifications
  };
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const data = buildDemoData();
  console.log(`Demo seed loaded: ${data.users.length} users, ${data.roles.length} roles.`);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
  console.table(
    data.users.map((user) => ({
      employeeNo: user.username,
      email: user.email,
      title: user.title
    }))
  );
}
