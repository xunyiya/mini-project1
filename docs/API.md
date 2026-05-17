# API 规范

当前后端基础路径为 `/api/v1`。所有响应统一为：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "traceId": "request-trace-id"
}
```

错误响应同样保持 `code/message/data/traceId` 结构。

## Day 1 接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | 无 | 健康检查 |
| `GET` | `/api/v1/auth/login-options` | 无 | 登录页职能和负责人选项 |
| `POST` | `/api/v1/auth/login` | 无 | 选择职能后使用工号和密码登录并返回 Bearer Token |
| `POST` | `/api/v1/auth/logout` | 登录 | 退出登录并写入审计 |
| `GET` | `/api/v1/auth/me` | 登录 | 当前用户、组织、角色、权限、菜单、按钮权限 |
| `GET` | `/api/v1/users` | `api.users.read` | 分页用户列表 |
| `POST` | `/api/v1/users` | `api.users.create` | 创建职能账号，工号按职能从 10001 自动递增，负责人仅限本职能，admin 不限 |
| `DELETE` | `/api/v1/users/:userId` | `api.users.delete` | 删除职能账号，负责人仅限本职能，负责人账号需先转移 |
| `GET` | `/api/v1/departments` | `api.departments.read` | 分页部门列表 |
| `PATCH` | `/api/v1/departments/:departmentId/leader` | `api.departments.leader.update` | admin 任命某职能负责人 |
| `GET` | `/api/v1/permissions/summary` | `api.permissions.summary.read` | 当前用户权限摘要 |

## 分页结构

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 1
}
```
