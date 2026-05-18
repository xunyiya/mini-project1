import type { MyReviewItem, RequirementPriority, RequirementType, SafeUser } from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPES,
  REVIEW_NODE_STATUS_LABELS
} from "@collab/shared";
import { ClipboardCheck, ExternalLink, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReviewNodeActions } from "../components/ReviewNodeActions";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

type ReviewFilters = {
  status: string;
  priority: string;
  type: string;
};

const defaultFilters: ReviewFilters = {
  status: "pending",
  priority: "",
  type: ""
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

export function ReviewsPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [items, setItems] = useState<MyReviewItem[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reviewPage, userPage] = await Promise.all([
        apiClient.myReviews({ ...appliedFilters, page: 1, pageSize: 50 }),
        apiClient.users(1, 100)
      ]);
      setItems(reviewPage.items);
      setUsers(userPage.items);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "评审列表加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  return (
    <div className="page-content reviews-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">评审审批</span>
            <h2>待我评审</h2>
          </div>
          <div className="permission-meter">
            <ClipboardCheck size={18} aria-hidden="true" />
            <span>{items.length} 个节点</span>
          </div>
        </div>
        <form className="review-filters" onSubmit={handleSubmit}>
          <label>
            <span>处理状态</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="pending">待处理</option>
              <option value="handled">已处理</option>
              <option value="overdue">已超时</option>
            </select>
          </label>
          <label>
            <span>需求优先级</span>
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
            <span>需求类型</span>
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
          <button className="ghost-button filter-submit" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>查询</span>
          </button>
        </form>
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>评审节点</h3>
        </div>
        {loading && items.length === 0 ? (
          <StateBlock type="loading" title="正在加载评审列表" />
        ) : items.length === 0 ? (
          <StateBlock type="empty" title="暂无待处理评审" />
        ) : (
          <div className="review-card-list">
            {items.map((item) => (
              <article className="review-card" key={item.node.id}>
                <div>
                  <span className="eyebrow">{item.requirement.code}</span>
                  <h3>{item.requirement.title}</h3>
                  <p>
                    {item.node.nodeName} · 到期 {formatDateTime(item.node.dueAt)} ·{" "}
                    {REVIEW_NODE_STATUS_LABELS[item.node.status]}
                  </p>
                </div>
                <div className="requirement-meta">
                  {item.requirement.priority ? (
                    <span className={`priority-pill priority-${item.requirement.priority.toLowerCase()}`}>
                      {REQUIREMENT_PRIORITY_LABELS[item.requirement.priority as RequirementPriority]}
                    </span>
                  ) : null}
                  {item.requirement.type ? (
                    <span className="type-pill">
                      {REQUIREMENT_TYPE_LABELS[item.requirement.type as RequirementType]}
                    </span>
                  ) : null}
                </div>
                <div className="row-actions">
                  <Link className="ghost-button" to={`/requirements/${item.requirement.id}`}>
                    <ExternalLink size={16} aria-hidden="true" />
                    <span>需求详情</span>
                  </Link>
                </div>
                <ReviewNodeActions node={item.node} users={users} onDone={() => void loadData()} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
