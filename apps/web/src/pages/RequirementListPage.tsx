import type {
  DepartmentWithLeader,
  RequirementPriority,
  RequirementStatus,
  RequirementType,
  RequirementView,
  SafeUser
} from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPES
} from "@collab/shared";
import { Edit3, FileText, Plus, RotateCcw, Send, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

type Filters = {
  search: string;
  status: string;
  priority: string;
  type: string;
  departmentId: string;
  ownerId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: string;
};

const defaultFilters: Filters = {
  search: "",
  status: "",
  priority: "",
  type: "",
  departmentId: "",
  ownerId: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortOrder: "desc"
};

const quickStatusFilters: Array<{ label: string; value: RequirementStatus | "" }> = [
  { label: "全部状态", value: "" },
  { label: "评审中", value: "IN_REVIEW" },
  { label: "需补充", value: "NEEDS_SUPPLEMENT" },
  { label: "已通过", value: "APPROVED" },
  { label: "已驳回", value: "REJECTED" },
  { label: "草稿", value: "DRAFT" }
];

const quickPriorityFilters: Array<{ label: string; value: RequirementPriority | "" }> = [
  { label: "全部优先级", value: "" },
  { label: "P0", value: "P0" },
  { label: "P1", value: "P1" },
  { label: "P2", value: "P2" },
  { label: "P3", value: "P3" }
];

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );
}

export function RequirementListPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [items, setItems] = useState<RequirementView[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewingDrafts = appliedFilters.status === "DRAFT";

  const loadReferences = useCallback(async () => {
    const [departmentPage, userPage] = await Promise.all([
      apiClient.departments(1, 100),
      apiClient.users(1, 100)
    ]);
    setDepartments(departmentPage.items);
    setUsers(userPage.items);
  }, []);

  const loadRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pageData = await apiClient.requirements({
        ...appliedFilters,
        page,
        pageSize: 10
      });
      setItems(pageData.items);
      setTotalPages(pageData.totalPages);
      setTotal(pageData.total);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "需求列表加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void loadReferences().catch(() => {
      setError("筛选数据加载失败");
    });
  }, [loadReferences]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function handleToggleDrafts() {
    const nextFilters = viewingDrafts ? defaultFilters : { ...defaultFilters, status: "DRAFT" };
    setPage(1);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function applyQuickFilter(field: "status" | "priority", value: string) {
    const nextValue = appliedFilters[field] === value ? "" : value;
    const nextFilters = {
      ...filters,
      [field]: nextValue
    };

    setPage(1);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function replaceRequirement(updatedRequirement: RequirementView) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === updatedRequirement.id ? updatedRequirement : item))
    );
  }

  async function handleSubmitReview(requirementId: string) {
    setSavingId(requirementId);
    setError(null);

    try {
      const updatedRequirement = await apiClient.submitRequirementReview(requirementId);
      replaceRequirement(updatedRequirement);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "提交评审失败";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleWithdraw(requirementId: string) {
    setSavingId(requirementId);
    setError(null);

    try {
      const updatedRequirement = await apiClient.withdrawRequirement(requirementId);
      replaceRequirement(updatedRequirement);
    } catch (caughtError) {
      const message = caughtError instanceof ApiClientError ? caughtError.message : "撤回需求失败";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="page-content requirements-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">需求池</span>
            <h2>统一需求入口</h2>
          </div>
          <div className="row-actions">
            <button className="ghost-button" type="button" onClick={handleToggleDrafts}>
              <FileText size={16} aria-hidden="true" />
              <span>{viewingDrafts ? "返回需求列表" : "查看草稿"}</span>
            </button>
            <Link className="primary-button inline-action" to="/requirements/new">
              <Plus size={18} aria-hidden="true" />
              <span>新建需求</span>
            </Link>
          </div>
        </div>

        <form className="requirement-filters" onSubmit={handleFilterSubmit}>
          <label className="filter-search">
            <span>关键词</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="标题、编号、提交人、跟进人"
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">全部状态</option>
              {REQUIREMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {REQUIREMENT_STATUS_LABELS[status]}
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
            <span>类型</span>
            <select
              value={filters.type}
              onChange={(event) => setFilters({ ...filters, type: event.target.value })}
            >
              <option value="">全部类型</option>
              {REQUIREMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REQUIREMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>提出部门</span>
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
            <span>跟进人</span>
            <select
              value={filters.ownerId}
              onChange={(event) => setFilters({ ...filters, ownerId: event.target.value })}
            >
              <option value="">全部跟进人</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}（{user.username}）
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
          <label>
            <span>排序</span>
            <select
              value={filters.sortBy}
              onChange={(event) => setFilters({ ...filters, sortBy: event.target.value })}
            >
              <option value="createdAt">创建时间</option>
              <option value="expectedReleaseDate">期望上线时间</option>
              <option value="priority">优先级</option>
            </select>
          </label>
          <button className="ghost-button filter-submit" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>查询</span>
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>{viewingDrafts ? "我的草稿" : "需求列表"}</h3>
          <span>共 {total} 条</span>
        </div>
        <div className="requirement-quick-filters" aria-label="快捷筛选">
          <div>
            <span>状态</span>
            <div className="filter-chip-group">
              {quickStatusFilters.map((chip) => (
                <button
                  key={chip.value || "all-status"}
                  className={`filter-chip${appliedFilters.status === chip.value ? " active" : ""}`}
                  type="button"
                  onClick={() => applyQuickFilter("status", chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>优先级</span>
            <div className="filter-chip-group">
              {quickPriorityFilters.map((chip) => (
                <button
                  key={chip.value || "all-priority"}
                  className={`filter-chip${appliedFilters.priority === chip.value ? " active" : ""}`}
                  type="button"
                  onClick={() => applyQuickFilter("priority", chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading && items.length === 0 ? (
          <StateBlock type="loading" title="正在加载需求" />
        ) : items.length === 0 ? (
          <StateBlock
            type="empty"
            title={viewingDrafts ? "暂无草稿，点击新建需求" : "暂无需求，点击新建需求"}
          />
        ) : (
          <div className="requirements-table">
            <div className="requirements-table-header" role="row">
              <span>需求</span>
              <span>状态</span>
              <span>优先级</span>
              <span>类型</span>
              <span>负责人 / 部门</span>
              <span>期望上线</span>
              <span>操作</span>
            </div>
            {items.map((item) => (
              <article className="requirement-row" key={item.id}>
                <div className="requirement-main">
                  <Link className="requirement-title" to={`/requirements/${item.id}`}>
                    {item.title}
                  </Link>
                  <span className="muted-text">
                    {item.code} · {item.submitter.displayName} 提交 · 创建 {formatDate(item.createdAt)}
                  </span>
                </div>
                <div className="requirement-table-cell requirement-status-cell">
                  <span className={`status-pill requirement-status status-${item.status.toLowerCase()}`}>
                    {REQUIREMENT_STATUS_LABELS[item.status as RequirementStatus]}
                  </span>
                </div>
                <div className="requirement-table-cell">
                  {item.priority ? (
                    <span className={`priority-pill priority-${item.priority.toLowerCase()}`}>
                      {REQUIREMENT_PRIORITY_LABELS[item.priority as RequirementPriority]}
                    </span>
                  ) : (
                      <span className="pill-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="requirement-table-cell">
                  {item.type ? (
                    <span className="type-pill">
                      {REQUIREMENT_TYPE_LABELS[item.type as RequirementType]}
                    </span>
                  ) : (
                    <span className="pill-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="requirement-owner">
                  <strong>{item.owner?.displayName ?? "未指定"}</strong>
                  <span>{item.department?.name ?? "未指定部门"}</span>
                </div>
                <div className="requirement-date">
                  <span>期望上线</span>
                  <strong>{formatDate(item.expectedReleaseDate)}</strong>
                </div>
                <div className="row-actions requirement-list-actions">
                  {item.availableActions.includes("edit") || item.availableActions.includes("updateStatus") ? (
                    <Link className="ghost-button" to={`/requirements/${item.id}/edit`}>
                      <Edit3 size={16} aria-hidden="true" />
                      <span>编辑</span>
                    </Link>
                  ) : (
                    <span className="action-placeholder" aria-hidden="true" />
                  )}
                  {item.availableActions.includes("submitReview") ? (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => void handleSubmitReview(item.id)}
                    >
                      <Send size={16} aria-hidden="true" />
                      <span>提交评审</span>
                    </button>
                  ) : (
                    <span className="action-placeholder" aria-hidden="true" />
                  )}
                  {item.availableActions.includes("withdraw") ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => void handleWithdraw(item.id)}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      <span>撤回</span>
                    </button>
                  ) : (
                    <span className="action-placeholder" aria-hidden="true" />
                  )}
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
