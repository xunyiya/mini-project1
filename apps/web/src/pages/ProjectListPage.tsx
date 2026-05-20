import type {
  DepartmentWithLeader,
  ProjectCreateInput,
  ProjectStatus,
  ProjectView,
  RequirementView,
  SafeUser
} from "@collab/shared";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  REQUIREMENT_STATUS_LABELS
} from "@collab/shared";
import { Eye, FolderKanban, Play, Plus, Search, SquareCheckBig } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

type Filters = {
  status: string;
  ownerId: string;
  departmentId: string;
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: Filters = {
  status: "",
  ownerId: "",
  departmentId: "",
  dateFrom: "",
  dateTo: ""
};

const defaultForm: ProjectCreateInput = {
  requirementId: "",
  name: "",
  description: "",
  ownerId: "",
  participantDepartmentIds: [],
  plannedStartDate: "",
  plannedEndDate: "",
  plannedReleaseDate: ""
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatProgress(project: ProjectView) {
  return `${project.taskStats.DONE}/${Object.values(project.taskStats).reduce((total, count) => total + count, 0)}`;
}

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

const healthLabels: Record<ProjectView["health"], string> = {
  GREEN: "绿灯",
  YELLOW: "黄灯",
  RED: "红灯"
};

export function ProjectListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [items, setItems] = useState<ProjectView[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [approvedRequirements, setApprovedRequirements] = useState<RequirementView[]>([]);
  const [form, setForm] = useState<ProjectCreateInput>({
    ...defaultForm,
    requirementId: searchParams.get("requirementId") ?? ""
  });
  const [showCreateForm, setShowCreateForm] = useState(Boolean(searchParams.get("requirementId")));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadReferences = useCallback(async () => {
    const [departmentPage, userPage, requirementPage] = await Promise.all([
      apiClient.departments(1, 100),
      apiClient.users(1, 100),
      apiClient.requirements({ status: "APPROVED", page: 1, pageSize: 100 })
    ]);

    setDepartments(departmentPage.items);
    setUsers(userPage.items);
    setApprovedRequirements(requirementPage.items);
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pageData = await apiClient.projects({
        ...appliedFilters,
        page,
        pageSize: 10
      });
      setItems(pageData.items);
      setTotal(pageData.total);
      setTotalPages(pageData.totalPages);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "项目列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadReferences().catch(() => {
      setError("项目创建所需数据加载失败");
    });
  }, [loadReferences]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function handleRequirementChange(requirementId: string) {
    const requirement = approvedRequirements.find((item) => item.id === requirementId);

    setForm({
      ...form,
      requirementId,
      name: requirement ? `${requirement.title}项目` : "",
      description: requirement?.goal ?? "",
      ownerId: requirement?.ownerId ?? form.ownerId,
      plannedReleaseDate: requirement?.expectedReleaseDate ?? "",
      participantDepartmentIds: requirement
        ? Array.from(
            new Set(
              [requirement.departmentId, ...requirement.relatedDepartments].filter(
                (departmentId): departmentId is string => Boolean(departmentId)
              )
            )
          )
        : []
    });
  }

  function toggleDepartment(departmentId: string) {
    const current = new Set(form.participantDepartmentIds ?? []);

    if (current.has(departmentId)) {
      current.delete(departmentId);
    } else {
      current.add(departmentId);
    }

    setForm({ ...form, participantDepartmentIds: Array.from(current) });
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiClient.createProject(form);
      setForm(defaultForm);
      setShowCreateForm(false);
      await Promise.all([loadProjects(), loadReferences()]);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "项目创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleProjectAction(projectId: string, action: "start" | "complete") {
    setSavingId(projectId);
    setError(null);

    try {
      const updatedProject =
        action === "start" ? await apiClient.startProject(projectId) : await apiClient.completeProject(projectId);
      setItems((currentItems) =>
        currentItems.map((item) => (item.id === projectId ? updatedProject : item))
      );
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "项目状态更新失败");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="page-content projects-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">项目空间</span>
            <h2>从已通过需求进入交付执行</h2>
          </div>
          <button
            className="primary-button inline-action"
            type="button"
            onClick={() => setShowCreateForm((current) => !current)}
          >
            <Plus size={18} aria-hidden="true" />
            <span>创建项目</span>
          </button>
        </div>

        {showCreateForm ? (
          <form className="project-create-form" onSubmit={handleCreateProject}>
            <label>
              <span>关联已通过需求</span>
              <select
                value={form.requirementId}
                onChange={(event) => handleRequirementChange(event.target.value)}
                required
              >
                <option value="">选择需求</option>
                {approvedRequirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.code} · {requirement.title} · {REQUIREMENT_STATUS_LABELS[requirement.status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>项目名称</span>
              <input
                value={form.name ?? ""}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="默认带入需求标题"
              />
            </label>
            <label>
              <span>项目负责人</span>
              <select
                value={form.ownerId}
                onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
                required
              >
                <option value="">选择负责人</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}（{user.username}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>计划开始</span>
              <input
                type="date"
                value={form.plannedStartDate ?? ""}
                onChange={(event) => setForm({ ...form, plannedStartDate: event.target.value })}
              />
            </label>
            <label>
              <span>计划结束</span>
              <input
                type="date"
                value={form.plannedEndDate ?? ""}
                onChange={(event) => setForm({ ...form, plannedEndDate: event.target.value })}
              />
            </label>
            <label>
              <span>计划上线</span>
              <input
                type="date"
                value={form.plannedReleaseDate ?? ""}
                onChange={(event) => setForm({ ...form, plannedReleaseDate: event.target.value })}
              />
            </label>
            <label className="project-description-field">
              <span>项目说明</span>
              <textarea
                value={form.description ?? ""}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="目标、范围或交付边界"
              />
            </label>
            <div className="project-department-picker">
              <span>参与部门</span>
              <div className="filter-chip-group">
                {departments.map((department) => (
                  <button
                    key={department.id}
                    className={`filter-chip${form.participantDepartmentIds?.includes(department.id) ? " active" : ""}`}
                    type="button"
                    onClick={() => toggleDepartment(department.id)}
                  >
                    {department.name}
                  </button>
                ))}
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              <FolderKanban size={18} aria-hidden="true" />
              <span>{saving ? "创建中" : "确认创建"}</span>
            </button>
          </form>
        ) : null}
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      <section className="content-band">
        <form className="project-filters" onSubmit={handleFilterSubmit}>
          <label>
            <span>状态</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">全部状态</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>负责人</span>
            <select
              value={filters.ownerId}
              onChange={(event) => setFilters({ ...filters, ownerId: event.target.value })}
            >
              <option value="">全部负责人</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>参与部门</span>
            <select
              value={filters.departmentId}
              onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}
            >
              <option value="">全部部门</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>开始时间</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
            />
          </label>
          <label>
            <span>结束时间</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
            />
          </label>
          <button className="ghost-button filter-submit" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>查询</span>
          </button>
        </form>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>项目列表</h3>
          <span>共 {total} 个项目</span>
        </div>
        {loading && items.length === 0 ? (
          <StateBlock type="loading" title="正在加载项目" />
        ) : items.length === 0 ? (
          <StateBlock type="empty" title="暂无项目，可从已通过需求创建项目" />
        ) : (
          <div className="project-list">
            {items.map((project) => (
              <article className="project-row" key={project.id}>
                <div className="project-row-main">
                  <div>
                    <Link className="requirement-title" to={`/projects/${project.id}`}>
                      {project.code} · {project.name}
                    </Link>
                    <span className="muted-text">
                      关联需求 {project.requirementCount} 条 · 计划上线 {formatDate(project.plannedReleaseDate)} · 最近活跃{" "}
                      {formatDateTime(project.lastActiveAt)}
                    </span>
                  </div>
                  <span className={`status-pill project-status status-${project.status.toLowerCase()}`}>
                    {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                  </span>
                </div>
                <div className="project-row-stats">
                  <span>
                    负责人 <strong>{project.owner?.displayName ?? "未指定"}</strong>
                  </span>
                  <span>
                    进度 <strong>{project.progress}%</strong>
                  </span>
                  <span>
                    任务 <strong>{formatProgress(project)}</strong>
                  </span>
                  <span>
                    成员 <strong>{project.memberCount}</strong>
                  </span>
                  <span>
                    健康度 <strong>{healthLabels[project.health]}</strong>
                  </span>
                  <span>
                    风险 <strong>{project.riskSummary}</strong>
                  </span>
                  <span>
                    待办堆积 <strong>{project.todoBacklogCount}</strong>
                  </span>
                </div>
                <div className="project-row-departments">
                  {project.requirements.slice(0, 4).map((requirement) => (
                    <Link className="type-pill" key={requirement.id} to={`/requirements/${requirement.id}`}>
                      {requirement.code} · {requirement.title}
                    </Link>
                  ))}
                  {project.requirements.length > 4 ? (
                    <span className="type-pill">等 {project.requirements.length} 条需求</span>
                  ) : null}
                </div>
                {project.warningSignals.length > 0 ? (
                  <div className="project-row-departments">
                    {project.warningSignals.map((signal) => (
                      <span className="priority-pill priority-p1" key={signal}>
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="project-row-departments">
                  {project.participantDepartments.map((department) => (
                    <span className="type-pill" key={department.id}>
                      {department.name}
                    </span>
                  ))}
                </div>
                <div className="row-actions">
                  <Link className="ghost-button" to={`/projects/${project.id}`}>
                    <Eye size={16} aria-hidden="true" />
                    <span>详情</span>
                  </Link>
                  {project.availableActions.includes("start") ? (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={savingId === project.id}
                      onClick={() => void handleProjectAction(project.id, "start")}
                    >
                      <Play size={16} aria-hidden="true" />
                      <span>启动</span>
                    </button>
                  ) : null}
                  {project.availableActions.includes("complete") ? (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={savingId === project.id}
                      onClick={() => void handleProjectAction(project.id, "complete")}
                    >
                      <SquareCheckBig size={16} aria-hidden="true" />
                      <span>完成</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="pagination-bar">
            <button
              className="ghost-button"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              上一页
            </button>
            <span>
              第 {page} / {totalPages} 页
            </span>
            <button
              className="ghost-button"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
