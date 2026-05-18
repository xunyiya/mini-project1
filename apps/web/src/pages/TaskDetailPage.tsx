import type {
  DepartmentWithLeader,
  RequirementPriority,
  SafeUser,
  TaskStatus,
  TaskUpdateInput,
  TaskView
} from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_TYPES
} from "@collab/shared";
import { ArrowRight, CheckCircle2, Save } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function nextStatuses(status: TaskStatus): TaskStatus[] {
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    TODO: ["IN_PROGRESS", "BLOCKED", "CANCELED"],
    IN_PROGRESS: ["DONE", "BLOCKED", "CANCELED"],
    BLOCKED: ["IN_PROGRESS", "CANCELED"],
    DONE: [],
    CANCELED: []
  };

  return transitions[status];
}

export function TaskDetailPage() {
  const { id } = useParams();
  const [task, setTask] = useState<TaskView | null>(null);
  const [projectTasks, setProjectTasks] = useState<TaskView[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [form, setForm] = useState<TaskUpdateInput>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const taskData = await apiClient.task(id);
      const [userPage, departmentPage, boardData] = await Promise.all([
        apiClient.users(1, 100),
        apiClient.departments(1, 100),
        taskData.project ? apiClient.projectTasks(taskData.project.id) : Promise.resolve(null)
      ]);

      setTask(taskData);
      setProjectTasks(boardData?.items ?? []);
      setUsers(userPage.items);
      setDepartments(departmentPage.items);
      setForm({
        title: taskData.title,
        description: taskData.description,
        taskType: taskData.taskType,
        priority: taskData.priority,
        assigneeId: taskData.assigneeId,
        departmentId: taskData.departmentId,
        startDate: taskData.startDate ?? "",
        dueDate: taskData.dueDate ?? "",
        dependencyTaskIds: taskData.dependencyTaskIds
      });
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  function toggleDependency(taskId: string) {
    const current = new Set(form.dependencyTaskIds ?? []);

    if (current.has(taskId)) {
      current.delete(taskId);
    } else {
      current.add(taskId);
    }

    setForm({ ...form, dependencyTaskIds: Array.from(current) });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedTask = await apiClient.updateTask(task.id, form);
      setTask(updatedTask);
      await loadTask();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: TaskStatus) {
    if (!task) {
      return;
    }

    const blockerReason =
      status === "BLOCKED" ? window.prompt("请填写阻塞原因")?.trim() ?? "" : undefined;

    if (status === "BLOCKED" && !blockerReason) {
      return;
    }

    if (!window.confirm(`确认将任务更新为「${TASK_STATUS_LABELS[status]}」？`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedTask = await apiClient.updateTaskStatus(task.id, {
        status,
        blockerReason,
        reason: status === "DONE" ? "任务完成" : undefined
      });
      setTask(updatedTask);
      await loadTask();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务状态更新失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <StateBlock type="loading" title="正在加载任务详情" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page-content">
        <StateBlock type="error" title={error ?? "任务不存在"} />
      </div>
    );
  }

  return (
    <div className="page-content task-detail-page">
      <section className="content-band">
        <div className="detail-hero">
          <div>
            <span className="eyebrow">任务详情</span>
            <h2>{task.title}</h2>
            <p>{task.description || "暂无任务说明"}</p>
          </div>
          <div className="detail-actions">
            <span className={`status-pill task-status status-${task.status.toLowerCase()}`}>
              {TASK_STATUS_LABELS[task.status]}
            </span>
            {task.availableActions.includes("updateStatus")
              ? nextStatuses(task.status).map((status) => (
                  <button
                    className="ghost-button"
                    type="button"
                    key={status}
                    disabled={saving}
                    onClick={() => void handleStatus(status)}
                  >
                    {status === "DONE" ? (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={16} aria-hidden="true" />
                    )}
                    <span>{TASK_STATUS_LABELS[status]}</span>
                  </button>
                ))
              : null}
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="project-summary-grid">
          <div>
            <span>所属项目</span>
            <strong>{task.project?.name ?? "-"}</strong>
          </div>
          <div>
            <span>任务类型</span>
            <strong>{TASK_TYPE_LABELS[task.taskType]}</strong>
          </div>
          <div>
            <span>负责人</span>
            <strong>{task.assignee?.displayName ?? "未指派"}</strong>
          </div>
          <div>
            <span>截止时间</span>
            <strong>{formatDate(task.dueDate)}</strong>
          </div>
          <div>
            <span>优先级</span>
            <strong>{REQUIREMENT_PRIORITY_LABELS[task.priority]}</strong>
          </div>
          <div>
            <span>完成时间</span>
            <strong>{formatDate(task.completedAt)}</strong>
          </div>
        </div>
        {task.blockerReason ? (
          <div className="task-blocker detail-blocker">阻塞原因：{task.blockerReason}</div>
        ) : null}
      </section>

      {task.availableActions.includes("edit") ? (
        <section className="content-band">
          <div className="section-heading">
            <h3>编辑任务</h3>
            <span>保存后写入审计日志</span>
          </div>
          <form className="task-create-form" onSubmit={handleSave}>
            <label>
              <span>任务标题</span>
              <input
                value={form.title ?? ""}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <label>
              <span>任务类型</span>
              <select
                value={form.taskType ?? task.taskType}
                onChange={(event) => setForm({ ...form, taskType: event.target.value as TaskUpdateInput["taskType"] })}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TASK_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={form.priority ?? task.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value as RequirementPriority })}
              >
                {REQUIREMENT_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {REQUIREMENT_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>负责人</span>
              <select
                value={form.assigneeId ?? ""}
                onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                required
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}（{user.username}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>负责部门</span>
              <select
                value={form.departmentId ?? ""}
                onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                required
              >
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
                value={form.startDate ?? ""}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </label>
            <label>
              <span>截止时间</span>
              <input
                type="date"
                value={form.dueDate ?? ""}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </label>
            <label className="task-description-field">
              <span>任务说明</span>
              <textarea
                value={form.description ?? ""}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <div className="task-dependency-picker">
              <span>依赖任务</span>
              <div className="filter-chip-group">
                {projectTasks
                  .filter((item) => item.id !== task.id)
                  .map((item) => (
                    <button
                      key={item.id}
                      className={`filter-chip${form.dependencyTaskIds?.includes(item.id) ? " active" : ""}`}
                      type="button"
                      onClick={() => toggleDependency(item.id)}
                    >
                      {item.code}
                    </button>
                  ))}
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              <Save size={18} aria-hidden="true" />
              <span>{saving ? "保存中" : "保存任务"}</span>
            </button>
          </form>
        </section>
      ) : null}

      <section className="content-band">
        <div className="section-heading">
          <h3>依赖与状态历史</h3>
          {task.project ? <Link className="ghost-button" to={`/projects/${task.project.id}`}>返回项目</Link> : null}
        </div>
        <div className="task-detail-grid">
          <div>
            <h4>依赖任务</h4>
            {task.dependencies.length === 0 ? (
              <StateBlock type="empty" title="暂无依赖任务" />
            ) : (
              <div className="dependency-list">
                {task.dependencies.map((dependency) => (
                  <Link className="dependency-item" key={dependency.id} to={`/tasks/${dependency.id}`}>
                    {dependency.code} · {dependency.title} · {TASK_STATUS_LABELS[dependency.status]}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4>状态历史</h4>
            <div className="history-list">
              {task.statusHistories.map((history) => (
                <div className="history-item" key={history.id}>
                  <span>
                    {history.fromStatus ? TASK_STATUS_LABELS[history.fromStatus] : "创建"} → {TASK_STATUS_LABELS[history.toStatus]}
                  </span>
                  <strong>{history.reason}</strong>
                  <small>{formatDate(history.createdAt)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
