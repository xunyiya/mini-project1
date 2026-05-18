# 多部门协同工具

> 面向企业开发流程的跨部门协同与交付管理平台，用于统一管理需求、评审、任务、会议、风险、变更、缺陷、上线与复盘，帮助产品、研发、测试、设计、运营、客服、法务、数据等部门在同一套流程中高效协作。

---

## 当前实现状态

Day 1 已初始化 npm workspaces 全栈骨架：

- `apps/api`：Express + TypeScript，提供 `/api/v1` 统一响应、JWT 鉴权、RBAC 权限校验、分页接口、审计日志和 demo seed 数据。
- `apps/web`：React + Vite，提供登录页、主布局、路由守卫、权限菜单过滤、消息入口和基础状态组件。
- `packages/shared`：共享 API 响应、分页、用户、部门、角色、权限、菜单等类型。
- 数据默认持久化到 SQLite：`.data/collab.sqlite`。可通过 `DATABASE_URL=sqlite://./.data/collab.sqlite` 指定路径；测试环境默认使用内存 SQLite。

所有 demo 账号密码均为 `Demo@123456`，账号见 [docs/DAY1.md](docs/DAY1.md)。
如需重置本地 demo 数据库，可运行 `npm run db:seed`。

---

## 1. 项目简介

在公司产品开发过程中，跨部门协作往往存在需求入口分散、评审结论难追踪、任务责任不清、变更影响不可见、风险暴露滞后、上线准备不完整等问题。本项目通过建设一套开发协同平台，将“需求提出 → 需求评审 → 项目排期 → 任务执行 → 会议跟进 → 风险变更 → 缺陷处理 → 上线检查 → 数据看板”串联为完整闭环。

本项目当前优先交付 MVP 版本，目标是在 10 天内完成可演示、可联调、可部署的核心功能链路。

---

## 2. 核心目标

- 统一各部门需求入口，避免需求散落在聊天、邮件和临时文档中。
- 建立标准化需求评审流程，确保每个需求都有明确结论和责任人。
- 用跨部门任务看板管理执行进度、依赖关系和阻塞状态。
- 通过风险、变更、缺陷、上线 Checklist 控制交付质量。
- 为项目负责人和管理层提供实时进度、风险和效率看板。
- 为后续接入 AI 会议总结、PRD 生成、智能问答和复盘分析预留扩展能力。

---

## 3. MVP 功能范围

### 3.1 首页工作台

首页工作台用于展示当前登录用户最需要处理的事项，包括：

- 我的待办任务
- 待我审批的需求、变更、上线申请
- 我负责的项目和需求
- 即将到期任务
- 当前阻塞事项
- 高优先级风险
- 最近通知消息

### 3.2 需求池

需求池是所有业务需求的统一入口，支持：

- 新建需求
- 编辑需求草稿
- 提交需求评审
- 需求列表筛选与搜索
- 需求详情查看
- 需求优先级管理
- 需求状态流转
- 需求评审记录
- 需求变更记录

### 3.3 需求评审

需求评审用于在开发前完成跨部门确认，支持：

- 发起评审
- 指定评审人
- 评审通过
- 评审驳回
- 要求补充信息
- 转派评审人
- 记录评审意见
- 自动通知相关人员

### 3.4 项目空间与任务看板

项目空间用于承载需求落地后的执行管理，支持：

- 从已通过需求创建项目
- 项目基础信息维护
- 任务创建、编辑、删除
- 看板视图展示任务状态
- 任务负责人分配
- 任务优先级与截止时间管理
- 任务依赖关系
- 阻塞状态标记
- 任务评论与附件

### 3.5 会议纪要与行动项

会议模块用于解决会议结论无法闭环的问题，支持：

- 创建会议记录
- 关联项目或需求
- 维护会议议题、结论和待办
- 将会议行动项自动转为任务
- 追踪行动项完成状态

### 3.6 风险与变更管理

风险和变更模块用于提前暴露项目问题，减少临时变更造成的返工，支持：

- 创建风险
- 标记风险等级
- 分配风险责任人
- 跟踪风险处理状态
- 发起需求变更申请
- 记录变更原因和影响范围
- 变更审批
- 变更结果同步到需求、项目和任务

### 3.7 缺陷与上线管理

上线模块用于保证发布前准备完整，支持：

- 创建上线计划
- 维护上线范围
- 维护上线时间
- 上线 Checklist 检查
- 缺陷创建与处理
- 缺陷验证关闭
- 上线审批
- 上线完成记录
- 回滚信息记录

### 3.8 消息中心

消息中心用于聚合系统提醒，支持：

- 待办提醒
- 审批提醒
- 状态变更提醒
- 风险提醒
- 任务到期提醒
- 上线检查提醒
- 已读 / 未读状态

### 3.9 数据看板 Lite

MVP 阶段先提供轻量数据看板，包括：

- 需求总数
- 项目总数
- 任务完成率
- 风险数量
- 缺陷数量
- 待审批数量
- 延期任务数量
- 上线计划数量

---

## 4. 核心业务流程

### 4.1 主流程

```text
登录系统
  ↓
提交需求
  ↓
需求评审
  ↓
评审通过
  ↓
创建项目
  ↓
拆分任务
  ↓
任务执行
  ↓
会议跟进 / 风险处理 / 变更审批 / 缺陷修复
  ↓
上线 Checklist
  ↓
上线审批
  ↓
上线完成
  ↓
数据看板与复盘
```

### 4.2 需求状态流转

```text
草稿 → 待评审 → 评审中 → 已通过 → 已排期 → 开发中 → 测试中 → 待上线 → 已上线 → 已归档
        ↓          ↓
      已撤回      已驳回
```

### 4.3 任务状态流转

```text
待开始 → 进行中 → 已完成
   ↓        ↓
 已取消    阻塞中
            ↓
          进行中
```

### 4.4 风险状态流转

```text
待处理 → 处理中 → 已解决 → 已关闭
   ↓
 已取消
```

### 4.5 变更状态流转

```text
草稿 → 待审批 → 已通过 → 已实施
        ↓
      已驳回
```

### 4.6 缺陷状态流转

```text
待处理 → 修复中 → 待验证 → 已关闭
   ↑                    ↓
   └────── 重新打开 ←────┘
```

### 4.7 上线状态流转

```text
草稿 → 检查中 → 待审批 → 已批准 → 已上线
        ↓          ↓          ↓
      检查失败    已驳回      已回滚
```

---

## 5. 用户角色

| 角色 | 说明 |
|---|---|
| 系统管理员 | 维护用户、部门、角色、权限、流程模板和系统配置 |
| 项目负责人 | 管理项目、排期、任务、风险、变更和上线计划 |
| 产品经理 | 维护需求、发起评审、确认验收结果 |
| 研发负责人 | 参与技术评审、分配研发任务、确认开发进度 |
| 研发人员 | 执行开发任务、更新任务状态、处理缺陷 |
| 测试人员 | 编写测试用例、提交缺陷、验证修复结果 |
| 设计人员 | 维护设计任务、上传设计稿、确认设计交付 |
| 运营人员 | 提交运营需求、跟进活动准备和上线事项 |
| 客服人员 | 提交用户反馈、查看上线说明和问题处理结果 |
| 法务 / 安全 / 数据 | 作为评审或咨询角色参与特定需求确认 |
| 管理层 | 查看项目进度、风险、效率和交付数据 |

---

## 6. 权限原则

本系统采用“角色权限 + 数据归属 + 流程节点权限”的组合策略。

- 用户只能操作自己有权限的模块。
- 需求提交人可以查看自己提交的需求。
- 需求负责人可以编辑需求、发起评审和维护需求状态。
- 项目负责人可以维护项目、任务、风险、变更和上线计划。
- 当前节点审批人可以执行审批操作。
- 管理层默认只读查看全局数据。
- 系统管理员拥有系统配置权限，但不默认代替业务角色执行审批。

---

## 7. 推荐技术栈

> 以下技术栈为推荐方案，实际开发时可根据团队已有基础调整。

### 前端

- React / Vue / Next.js
- TypeScript


### 后端

- Node.js NestJS / Python FastAPI / Java Spring Boot
- Swagger / OpenAPI 接口文档

### 数据库与基础设施

- PostgreSQL / MySQL
- Redis


---

## 8. 推荐目录结构

```text
.
├── README.md
├── AGENTS.md
├── docs/
│   ├── PRD.md
│   ├── API.md
│   ├── DATABASE.md
│   └── DEVELOPMENT_PLAN.md
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── api/
│       ├── src/
│       ├── test/
│       └── package.json
├── packages/
│   ├── shared/
│   └── ui/
├── scripts/
├── docker-compose.yml
├── .env.example
└── package.json
```

如采用单体项目或其他框架，可根据实际情况调整目录结构，但建议保留 `docs/`、`.env.example`、`README.md` 和 `AGENTS.md`。

---

## 9. 本地启动

> 以下命令以 Node.js  项目为例，其他技术栈请按实际情况替换。

### 9.1 克隆项目

```bash
git clone <repository-url>
cd <project-name>
```

### 9.2 安装依赖

```bash
npm install
```

或：

```bash
pnpm install
```

### 9.3 配置环境变量

```bash
cp .env.example .env
```

根据本地环境修改 `.env`：

```env
APP_ENV=development
APP_PORT=3000
WEB_PORT=5173
DATABASE_URL=postgresql://user:password@localhost:5432/collab_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=please_change_this_secret
UPLOAD_DIR=./uploads
```

### 9.4 启动数据库

```bash
docker compose up -d
```

### 9.5 执行数据库迁移

```bash
npm run db:migrate
```

### 9.6 初始化演示数据

```bash
npm run db:seed
```

### 9.7 启动开发服务

```bash
npm run dev
```

启动后访问：

```text
前端地址：http://localhost:5173
后端地址：http://localhost:3000
接口文档：http://localhost:3000/docs
```

---

## 10. 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动前后端开发服务 |
| `npm run build` | 构建生产包 |
| `npm run test` | 执行单元测试 |
| `npm run test:e2e` | 执行端到端测试 |
| `npm run lint` | 执行代码规范检查 |
| `npm run format` | 格式化代码 |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:seed` | 初始化演示数据 |
| `npm run db:reset` | 重置数据库 |

---

## 11. 核心接口规划

### 11.1 认证与用户

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/login` | 用户登录 |
| `POST` | `/api/auth/logout` | 用户退出 |
| `GET` | `/api/users/me` | 获取当前用户信息 |
| `GET` | `/api/users` | 获取用户列表 |
| `GET` | `/api/departments` | 获取部门列表 |

### 11.2 需求

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/requirements` | 获取需求列表 |
| `POST` | `/api/requirements` | 创建需求 |
| `GET` | `/api/requirements/:id` | 获取需求详情 |
| `PUT` | `/api/requirements/:id` | 更新需求 |
| `DELETE` | `/api/requirements/:id` | 删除需求草稿 |
| `POST` | `/api/requirements/:id/submit` | 提交评审 |
| `POST` | `/api/requirements/:id/withdraw` | 撤回需求 |

### 11.3 评审

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/reviews` | 获取评审列表 |
| `POST` | `/api/reviews` | 创建评审 |
| `POST` | `/api/reviews/:id/approve` | 评审通过 |
| `POST` | `/api/reviews/:id/reject` | 评审驳回 |
| `POST` | `/api/reviews/:id/request-change` | 要求补充 |
| `POST` | `/api/reviews/:id/transfer` | 转派评审 |

### 11.4 项目与任务

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/projects` | 获取项目列表 |
| `POST` | `/api/projects` | 创建项目 |
| `GET` | `/api/projects/:id` | 获取项目详情 |
| `PUT` | `/api/projects/:id` | 更新项目 |
| `GET` | `/api/projects/:id/tasks` | 获取项目任务 |
| `POST` | `/api/tasks` | 创建任务 |
| `PUT` | `/api/tasks/:id` | 更新任务 |
| `POST` | `/api/tasks/:id/status` | 更新任务状态 |
| `POST` | `/api/tasks/:id/block` | 标记阻塞 |
| `POST` | `/api/tasks/:id/unblock` | 解除阻塞 |

### 11.5 会议、风险、变更、缺陷、上线

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/meetings` | 获取会议列表 |
| `POST` | `/api/meetings` | 创建会议 |
| `POST` | `/api/meetings/:id/action-items` | 创建会议行动项 |
| `POST` | `/api/action-items/:id/convert-task` | 行动项转任务 |
| `GET` | `/api/risks` | 获取风险列表 |
| `POST` | `/api/risks` | 创建风险 |
| `PUT` | `/api/risks/:id` | 更新风险 |
| `GET` | `/api/changes` | 获取变更列表 |
| `POST` | `/api/changes` | 创建变更申请 |
| `POST` | `/api/changes/:id/approve` | 变更审批通过 |
| `POST` | `/api/changes/:id/reject` | 变更审批驳回 |
| `GET` | `/api/defects` | 获取缺陷列表 |
| `POST` | `/api/defects` | 创建缺陷 |
| `PUT` | `/api/defects/:id` | 更新缺陷 |
| `GET` | `/api/releases` | 获取上线计划列表 |
| `POST` | `/api/releases` | 创建上线计划 |
| `POST` | `/api/releases/:id/checklist` | 更新上线检查项 |
| `POST` | `/api/releases/:id/approve` | 上线审批通过 |
| `POST` | `/api/releases/:id/publish` | 标记上线完成 |

---

## 12. 数据对象概览

核心数据对象包括：

- User：用户
- Department：部门
- Role：角色
- Requirement：需求
- Review：评审
- Project：项目
- Task：任务
- Meeting：会议
- ActionItem：会议行动项
- Risk：风险
- ChangeRequest：变更申请
- Defect：缺陷
- ReleasePlan：上线计划
- ReleaseChecklistItem：上线检查项
- Notification：通知
- Attachment：附件
- Comment：评论
- AuditLog：审计日志

---

## 13. 开发规范

### 13.1 分支规范

```text
main                 生产稳定分支
develop              开发主分支
feature/<module>     功能开发分支
fix/<issue>          缺陷修复分支
release/<version>    发布分支
```

### 13.2 提交规范

```text
feat: 新增功能
fix: 修复问题
refactor: 重构代码
style: 调整样式或格式
test: 新增或修改测试
docs: 修改文档
chore: 工程配置或依赖调整
```

示例：

```bash
git commit -m "feat: add requirement review workflow"
```

### 13.3 代码要求

- 业务状态必须使用枚举或常量统一管理。
- 所有核心写操作需要记录审计日志。
- 所有列表接口需要支持分页。
- 涉及权限的数据查询必须做后端校验。
- 前端页面需要处理 loading、empty、error 状态。
- 接口返回结构保持统一。
- 新增核心功能时同步补充测试或最小验证用例。

---

## 14. 统一接口返回结构

### 成功响应

```json
{
  "success": true,
  "data": {},
  "message": "success"
}
```

### 分页响应

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  },
  "message": "success"
}
```

### 错误响应

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "参数校验失败",
  "details": []
}
```

---

## 15. 验收标准

MVP 版本完成后，应至少满足以下验收条件：

- 用户可以登录系统并获取当前用户信息。
- 不同角色可以看到不同菜单和操作入口。
- 用户可以创建需求、编辑需求、提交评审。
- 评审人可以对需求执行通过、驳回、要求补充操作。
- 已通过需求可以创建项目并拆分任务。
- 任务可以在看板中流转状态。
- 会议行动项可以转为任务。
- 项目可以创建风险、变更、缺陷和上线计划。
- 上线计划必须完成 Checklist 后才能进入审批或上线状态。
- 消息中心可以展示待办和审批提醒。
- 数据看板可以展示核心统计指标。
- 后端接口具备基础鉴权和权限校验。
- 本地环境可以通过 README 完成启动。
- 演示数据可以覆盖完整主链路。

---

## 16. 10 天交付节奏

| 天数 | 重点 |
|---|---|
| Day 1 | 项目骨架、认证、权限底座 |
| Day 2 | 需求池、需求表单、需求详情 |
| Day 3 | 需求评审、审批节点、流程模板 |
| Day 4 | 项目空间、任务看板、任务状态机 |
| Day 5 | 会议纪要、行动项转任务、评论附件 |
| Day 6 | 风险台账、变更申请、影响评估 |
| Day 7 | 上线计划、上线 Checklist、缺陷管理 |
| Day 8 | 首页工作台、消息中心、数据看板 Lite、全局搜索 |
| Day 9 | 权限收口、流程模板配置、端到端联调 |
| Day 10 | 回归修复、演示数据、部署文档、交付验收 |

---

## 17. 后续规划

MVP 完成后，可继续扩展以下能力：

- AI 会议纪要自动总结
- AI PRD 初稿生成
- AI 项目风险识别
- 智能问答助手
- 自动生成复盘报告
- 与企业微信、飞书、钉钉集成
- 与 GitLab、GitHub、Jenkins、Jira、禅道、TAPD 集成
- 更完整的数据分析看板
- 可配置流程引擎
- 多租户与组织级权限管理

---

## 18. 维护说明

本文档用于说明项目目标、功能范围、开发启动方式和协作规范。随着产品功能和技术架构调整，README 需要同步更新，避免文档与实际系统不一致。

建议在每次版本发布时同步检查：

- 启动命令是否准确
- 环境变量是否完整
- 接口路径是否变更
- 目录结构是否变化
- 验收标准是否需要更新
- 后续规划是否需要调整

---

## 19. 项目口号

> 让开发过程中的每个需求、每个任务、每次变更、每个风险、每次上线都有据可查、有责可追、有闭环可复盘。
