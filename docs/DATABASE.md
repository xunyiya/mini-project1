# 数据库配置

Day 1 先使用 demo seed 内存仓库，配置入口位于 `apps/api/src/config/database.ts`。

```env
DATABASE_URL=memory://demo-seed
```

当前基础对象已按后续持久化建模：

- `User`
- `Department`
- `Role`
- `Permission`
- `AuditLog`
- `Notification`

后续接入 PostgreSQL / Prisma / TypeORM 时，应保留现有 service 与 route 层的权限校验、统一响应和审计写入约束。
