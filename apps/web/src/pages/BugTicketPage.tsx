import type {
  BugStatus,
  BugTicketCreateInput,
  BugTicketUpdateInput,
  BugTicketView,
  ProjectView,
  RequirementView,
  SafeUser
} from "@collab/shared";
import {
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  BUG_STATUSES,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS
} from "@collab/shared";
import { Pencil, Plus, Save, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type Filters = {
  search: string;
  status: string;
  severity: string;
  priority: string;
  handlerId: string;
};

type BugFormState = {
  title: string;
  severity: string;
  priority: string;
  status: string;
  requirementId: string;
  projectId: string;
  finderId: string;
  handlerId: string;
  relatedUserIds: string[];
  description: string;
};

const defaultFilters: Filters = {
  search: "",
  status: "",
  severity: "",
  priority: "",
  handlerId: ""
};

const defaultForm: BugFormState = {
  title: "",
  severity: "S3",
  priority: "P2",
  status: "CREATED",
  requirementId: "",
  projectId: "",
  finderId: "",
  handlerId: "",
  relatedUserIds: [],
  description: ""
};

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function userLabel(user: Pick<SafeUser, "username" | "displayName" | "title">) {
  return `${user.displayName}（${user.username} · ${user.title}）`;
}

function formFromBugTicket(bugTicket: BugTicketView): BugFormState {
  return {
    title: bugTicket.title,
    severity: bugTicket.severity,
    priority: bugTicket.priority,
    status: bugTicket.status,
    requirementId: bugTicket.requirementId,
    projectId: bugTicket.projectId,
    finderId: bugTicket.finderId,
    handlerId: bugTicket.handlerId,
    relatedUserIds: bugTicket.relatedUserIds,
    description: bugTicket.description
  };
}

export function BugTicketPage() {
  const { me } = useAuth();
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [items, setItems] = useState<BugTicketView[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [requirements, setRequirements] = useState<RequirementView[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [form, setForm] = useState<BugFormState>({
    ...defaultForm,
    finderId: me?.user.id ?? ""
  });
  const [showForm, setShowForm] = useState(false);
  const [editingBugId, setEditingBugId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canCreate = me?.availableActions.defects?.includes("create") ?? false;
  const projectOptions = useMemo(
    () =>
      form.requirementId
        ? projects.filter((project) => project.requirementId === form.requirementId)
        : projects,
    [form.requirementId, projects]
  );

  const loadReferences = useCallback(async () => {
    const [userPage, requirementPage, projectPage] = await Promise.all([
      apiClient.users(1, 100),
      apiClient.requirements({ page: 1, pageSize: 100 }),
      apiClient.projects({ page: 1, pageSize: 100 })
    ]);

    setUsers(userPage.items);
    setRequirements(requirementPage.items);
    setProjects(projectPage.items);
  }, []);

  const loadBugTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pageData = await apiClient.bugTickets({
        ...appliedFilters,
        page,
        pageSize: 10
      });
      setItems(pageData.items);
      setTotal(pageData.total);
      setTotalPages(pageData.totalPages);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "bug单列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadReferences().catch(() => {
      setError("bug单所需数据加载失败");
    });
  }, [loadReferences]);

  useEffect(() => {
    void loadBugTickets();
  }, [loadBugTickets]);

  function resetForm() {
    setForm({
      ...defaultForm,
      finderId: me?.user.id ?? ""
    });
    setEditingBugId(null);
    setShowForm(false);
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function handleRequirementChange(requirementId: string) {
    const currentProject = projects.find((project) => project.id === form.projectId);

    setForm({
      ...form,
      requirementId,
      projectId: currentProject?.requirementId === requirementId ? form.projectId : ""
    });
  }

  function toggleRelatedUser(userId: string) {
    const current = new Set(form.relatedUserIds);

    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }

    setForm({ ...form, relatedUserIds: Array.from(current) });
  }

  function buildPayload(): BugTicketCreateInput | BugTicketUpdateInput {
    return {
      title: form.title,
      severity: form.severity as BugTicketCreateInput["severity"],
      priority: form.priority as BugTicketCreateInput["priority"],
      status: form.status as BugStatus,
      requirementId: form.requirementId,
      projectId: form.projectId,
      finderId: form.finderId,
      handlerId: form.handlerId,
      relatedUserIds: form.relatedUserIds,
      description: form.description
    };
  }

  async function handleSaveBugTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingBugId) {
        await apiClient.updateBugTicket(editingBugId, buildPayload());
      } else {
        await apiClient.createBugTicket(buildPayload() as BugTicketCreateInput);
      }

      resetForm();
      await Promise.all([loadBugTickets(), loadReferences()]);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "bug单保存失败");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setForm({
      ...defaultForm,
      finderId: me?.user.id ?? ""
    });
    setEditingBugId(null);
    setShowForm(true);
  }

  function startEdit(bugTicket: BugTicketView) {
    setForm(formFromBugTicket(bugTicket));
    setEditingBugId(bugTicket.id);
    setShowForm(true);
  }

  return (
    <div className="page-content bug-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">测试与上线质量</span>
            <h2>bug单</h2>
          </div>
          {canCreate ? (
            <button className="primary-button inline-action" type="button" onClick={startCreate}>
              <Plus size={18} aria-hidden="true" />
              <span>新建bug单</span>
            </button>
          ) : null}
        </div>
        {error ? <div className="form-error">{error}</div> : null}

        {showForm ? (
          <form className="bug-ticket-form" onSubmit={handleSaveBugTicket}>
            <div className="form-grid two-columns">
              <label className="wide-field">
                <span>标题</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>严重等级</span>
                <select
                  value={form.severity}
                  onChange={(event) => setForm({ ...form, severity: event.target.value })}
                  required
                >
                  {BUG_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {BUG_SEVERITY_LABELS[severity]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>优先级</span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  required
                >
                  {REQUIREMENT_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {REQUIREMENT_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  required
                >
                  {BUG_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {BUG_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>关联需求</span>
                <select
                  value={form.requirementId}
                  onChange={(event) => handleRequirementChange(event.target.value)}
                  required
                >
                  <option value="">请选择</option>
                  {requirements.map((requirement) => (
                    <option key={requirement.id} value={requirement.id}>
                      {requirement.code} · {requirement.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>对应项目</span>
                <select
                  value={form.projectId}
                  onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                  required
                >
                  <option value="">请选择</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>发现人</span>
                <select
                  value={form.finderId}
                  onChange={(event) => setForm({ ...form, finderId: event.target.value })}
                  required
                >
                  <option value="">请选择</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>处理人</span>
                <select
                  value={form.handlerId}
                  onChange={(event) => setForm({ ...form, handlerId: event.target.value })}
                  required
                >
                  <option value="">请选择</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="wide-field related-user-picker">
                <span>bug关联人</span>
                <div className="filter-chip-group">
                  {users.map((user) => {
                    const selected = form.relatedUserIds.includes(user.id);

                    return (
                      <button
                        className={`filter-chip${selected ? " active" : ""}`}
                        key={user.id}
                        type="button"
                        onClick={() => toggleRelatedUser(user.id)}
                      >
                        {user.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="wide-field">
                <span>bug描述</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={resetForm}>
                <X size={16} aria-hidden="true" />
                <span>取消</span>
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                <Save size={18} aria-hidden="true" />
                <span>{saving ? "保存中" : editingBugId ? "保存修改" : "创建bug单"}</span>
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="content-band">
        <form className="bug-filters" onSubmit={handleFilterSubmit}>
          <label className="filter-search">
            <span>搜索</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="编号、标题、描述"
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">全部状态</option>
              {BUG_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {BUG_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>严重等级</span>
            <select
              value={filters.severity}
              onChange={(event) => setFilters({ ...filters, severity: event.target.value })}
            >
              <option value="">全部等级</option>
              {BUG_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {BUG_SEVERITY_LABELS[severity]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>优先级</span>
            <select
              value={filters.priority}
              onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
            >
              <option value="">全部优先级</option>
              {REQUIREMENT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {REQUIREMENT_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>处理人</span>
            <select
              value={filters.handlerId}
              onChange={(event) => setFilters({ ...filters, handlerId: event.target.value })}
            >
              <option value="">全部处理人</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost-button filter-submit" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>查询</span>
          </button>
        </form>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>bug单列表</h3>
          <span>共 {total} 条</span>
        </div>
        {loading && items.length === 0 ? (
          <StateBlock type="loading" title="正在加载bug单" />
        ) : items.length === 0 ? (
          <StateBlock type="empty" title="暂无bug单" />
        ) : (
          <div className="bug-ticket-table">
            <div className="bug-ticket-table-header">
              <span>bug</span>
              <span>状态</span>
              <span>等级 / 优先级</span>
              <span>需求 / 项目</span>
              <span>人员</span>
              <span>创建时间</span>
              <span>操作</span>
            </div>
            {items.map((bugTicket) => (
              <article className="bug-ticket-row" key={bugTicket.id}>
                <div className="bug-ticket-main">
                  <strong>{bugTicket.title}</strong>
                  <span>{bugTicket.code}</span>
                </div>
                <div className="requirement-table-cell">
                  <span className={`status-pill bug-status status-${bugTicket.status.toLowerCase()}`}>
                    {BUG_STATUS_LABELS[bugTicket.status]}
                  </span>
                </div>
                <div className="bug-ticket-pills">
                  <span className={`severity-pill severity-${bugTicket.severity.toLowerCase()}`}>
                    {BUG_SEVERITY_LABELS[bugTicket.severity]}
                  </span>
                  <span className={`priority-pill priority-${bugTicket.priority.toLowerCase()}`}>
                    {REQUIREMENT_PRIORITY_LABELS[bugTicket.priority]}
                  </span>
                </div>
                <div className="bug-ticket-relation">
                  {bugTicket.requirement ? (
                    <Link to={`/requirements/${bugTicket.requirement.id}`}>
                      {bugTicket.requirement.code} · {bugTicket.requirement.title}
                    </Link>
                  ) : (
                    <span>-</span>
                  )}
                  {bugTicket.project ? (
                    <Link to={`/projects/${bugTicket.project.id}`}>
                      {bugTicket.project.code} · {bugTicket.project.name}
                    </Link>
                  ) : (
                    <span>-</span>
                  )}
                </div>
                <div className="bug-ticket-people">
                  <span>发现：{bugTicket.finder?.displayName ?? "-"}</span>
                  <span>处理：{bugTicket.handler?.displayName ?? "-"}</span>
                  <span>
                    关联：
                    {bugTicket.relatedUsers.length > 0
                      ? bugTicket.relatedUsers.map((user) => user.displayName).join("、")
                      : "-"}
                  </span>
                </div>
                <div className="bug-ticket-date">
                  <span>创建</span>
                  <strong>{formatDateTime(bugTicket.createdAt)}</strong>
                </div>
                <div className="row-actions bug-ticket-actions">
                  {bugTicket.availableActions.includes("edit") ? (
                    <button className="ghost-button" type="button" onClick={() => startEdit(bugTicket)}>
                      <Pencil size={16} aria-hidden="true" />
                      <span>编辑</span>
                    </button>
                  ) : (
                    <span className="muted-text">只读</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="pagination-bar">
            <button className="ghost-button" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </button>
            <span>第 {page} / {totalPages} 页</span>
            <button
              className="ghost-button"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
