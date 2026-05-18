import type { RequirementPriority, TaskStatus, TaskView } from "@collab/shared";
import {
  REQUIREMENT_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS
} from "@collab/shared";
import { CalendarDays, Eye, FolderKanban } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );
}

export function MyTasksPage() {
  const [items, setItems] = useState<TaskView[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pageData = await apiClient.myTasks({ page, pageSize: 10 });
      setItems(pageData.items);
      setTotalPages(pageData.totalPages);
      setTotal(pageData.total);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "我的任务加载失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <div className="page-content tasks-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">任务看板</span>
            <h2>我的任务</h2>
          </div>
          <span>共 {total} 个任务</span>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {loading && items.length === 0 ? (
          <StateBlock type="loading" title="正在加载我的任务" />
        ) : items.length === 0 ? (
          <StateBlock type="empty" title="暂无分配给你的任务" />
        ) : (
          <div className="task-list">
            {items.map((task) => (
              <article className={`task-list-row${task.overdue ? " overdue" : ""}`} key={task.id}>
                <div>
                  <Link className="requirement-title" to={`/tasks/${task.id}`}>
                    {task.title}
                  </Link>
                  <span className="muted-text">
                    {task.code} · {task.project?.name ?? "-"} · {TASK_TYPE_LABELS[task.taskType]}
                  </span>
                </div>
                <span className={`status-pill task-status status-${task.status.toLowerCase()}`}>
                  {TASK_STATUS_LABELS[task.status as TaskStatus]}
                </span>
                <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>
                  {REQUIREMENT_PRIORITY_LABELS[task.priority as RequirementPriority]}
                </span>
                <span className="task-date">
                  <CalendarDays size={14} aria-hidden="true" />
                  {formatDate(task.dueDate)}
                </span>
                <div className="row-actions">
                  {task.project ? (
                    <Link className="ghost-button" to={`/projects/${task.project.id}`}>
                      <FolderKanban size={16} aria-hidden="true" />
                      <span>项目</span>
                    </Link>
                  ) : null}
                  <Link className="ghost-button" to={`/tasks/${task.id}`}>
                    <Eye size={16} aria-hidden="true" />
                    <span>详情</span>
                  </Link>
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
