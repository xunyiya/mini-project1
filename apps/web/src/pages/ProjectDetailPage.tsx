import type {
  DepartmentWithLeader,
  ProjectStatus,
  ProjectTaskBoard,
  ProjectView,
  RequirementPriority,
  SafeUser,
  TaskCreateInput,
  TaskStatus,
  TaskView
} from "@collab/shared";
import {
  PROJECT_STATUS_LABELS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_TYPES
} from "@collab/shared";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Plus, Play, SquareCheckBig } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

const defaultTaskForm: TaskCreateInput = {
  title: "",
  description: "",
  taskType: "FRONTEND",
  priority: "P2",
  assigneeId: "",
  departmentId: "",
  startDate: "",
  dueDate: "",
  dependencyTaskIds: []
};

const boardColumns: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELED"];

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );
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

export function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [taskBoard, setTaskBoard] = useState<ProjectTaskBoard | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [taskForm, setTaskForm] = useState<TaskCreateInput>(defaultTaskForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectData, boardData, userPage, departmentPage] = await Promise.all([
        apiClient.project(id),
        apiClient.projectTasks(id),
        apiClient.users(1, 100),
        apiClient.departments(1, 100)
      ]);
      setProject(projectData);
      setTaskBoard(boardData);
      setUsers(userPage.items);
      setDepartments(departmentPage.items);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "项目详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function refreshProjectAndTasks() {
    if (!id) {
      return;
    }

    const [projectData, boardData] = await Promise.all([
      apiClient.project(id),
      apiClient.projectTasks(id)
    ]);
    setProject(projectData);
    setTaskBoard(boardData);
  }

  function toggleDependency(taskId: string) {
    const current = new Set(taskForm.dependencyTaskIds ?? []);

    if (current.has(taskId)) {
      current.delete(taskId);
    } else {
      current.add(taskId);
    }

    setTaskForm({ ...taskForm, dependencyTaskIds: Array.from(current) });
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.createTask(id, taskForm);
      setTaskForm(defaultTaskForm);
      await refreshProjectAndTasks();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleProjectAction(action: "start" | "complete") {
    if (!project) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedProject =
        action === "start" ? await apiClient.startProject(project.id) : await apiClient.completeProject(project.id);
      setProject(updatedProject);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "项目状态更新失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskStatus(task: TaskView, status: TaskStatus) {
    const blockerReason =
      status === "BLOCKED" ? window.prompt("请填写阻塞原因")?.trim() ?? "" : undefined;

    if (status === "BLOCKED" && !blockerReason) {
      return;
    }

    if (!window.confirm(`确认将任务更新为「${TASK_STATUS_LABELS[status]}」？`)) {
      return;
    }

    setSavingTaskId(task.id);
    setError(null);

    try {
      await apiClient.updateTaskStatus(task.id, {
        status,
        blockerReason,
        reason: status === "DONE" ? "任务完成" : undefined
      });
      await refreshProjectAndTasks();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务状态更新失败");
    } finally {
      setSavingTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <StateBlock type="loading" title="正在加载项目详情" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-content">
        <StateBlock type="error" title={error ?? "项目不存在"} />
      </div>
    );
  }

  return (
    <div className="page-content project-detail-page">
      <section className="content-band">
        <div className="detail-hero">
          <div>
            <span className="eyebrow">项目详情</span>
            <h2>{project.name}</h2>
            <p>{project.description || "暂无项目说明"}</p>
          </div>
          <div className="detail-actions">
            <span className={`status-pill project-status status-${project.status.toLowerCase()}`}>
              {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
            </span>
            {project.availableActions.includes("start") ? (
              <button className="ghost-button" type="button" disabled={saving} onClick={() => void handleProjectAction("start")}>
                <Play size={16} aria-hidden="true" />
                <span>启动项目</span>
              </button>
            ) : null}
            {project.availableActions.includes("complete") ? (
              <button className="ghost-button" type="button" disabled={saving} onClick={() => void handleProjectAction("complete")}>
                <SquareCheckBig size={16} aria-hidden="true" />
                <span>完成项目</span>
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="project-summary-grid">
          <div>
            <span>关联需求</span>
            <strong>{project.requirement?.code ?? "-"}</strong>
          </div>
          <div>
            <span>负责人</span>
            <strong>{project.owner?.displayName ?? "未指定"}</strong>
          </div>
          <div>
            <span>计划周期</span>
            <strong>
              {formatDate(project.plannedStartDate)} - {formatDate(project.plannedEndDate)}
            </strong>
          </div>
          <div>
            <span>计划上线</span>
            <strong>{formatDate(project.plannedReleaseDate)}</strong>
          </div>
          <div>
            <span>任务完成率</span>
            <strong>{project.taskCompletionRate}%</strong>
          </div>
          <div>
            <span>阻塞任务</span>
            <strong>{project.taskStats.BLOCKED}</strong>
          </div>
        </div>
        <div className="project-row-departments">
          {project.participantDepartments.map((department) => (
            <span className="type-pill" key={department.id}>
              {department.name}
            </span>
          ))}
        </div>
      </section>

      <section className="content-band">
        <div className="project-tabs">
          <span className="active">任务看板</span>
          <span>任务列表</span>
          <span>会议</span>
          <span>风险</span>
          <span>变更</span>
          <span>缺陷</span>
          <span>上线计划</span>
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>创建任务</h3>
          <span>任务创建后会通知负责人</span>
        </div>
        {project.availableActions.includes("createTask") ? (
          <form className="task-create-form" onSubmit={handleCreateTask}>
            <label>
              <span>任务标题</span>
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                placeholder="输入任务标题"
                required
              />
            </label>
            <label>
              <span>任务类型</span>
              <select
                value={taskForm.taskType}
                onChange={(event) => setTaskForm({ ...taskForm, taskType: event.target.value as TaskCreateInput["taskType"] })}
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
                value={taskForm.priority}
                onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as RequirementPriority })}
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
                value={taskForm.assigneeId}
                onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })}
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
              <span>负责部门</span>
              <select
                value={taskForm.departmentId}
                onChange={(event) => setTaskForm({ ...taskForm, departmentId: event.target.value })}
                required
              >
                <option value="">选择部门</option>
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
                value={taskForm.startDate ?? ""}
                onChange={(event) => setTaskForm({ ...taskForm, startDate: event.target.value })}
              />
            </label>
            <label>
              <span>截止时间</span>
              <input
                type="date"
                value={taskForm.dueDate ?? ""}
                onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
              />
            </label>
            <label className="task-description-field">
              <span>任务说明</span>
              <textarea
                value={taskForm.description ?? ""}
                onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                placeholder="任务范围、验收口径或注意事项"
              />
            </label>
            <div className="task-dependency-picker">
              <span>依赖任务</span>
              <div className="filter-chip-group">
                {(taskBoard?.items ?? []).map((task) => (
                  <button
                    key={task.id}
                    className={`filter-chip${taskForm.dependencyTaskIds?.includes(task.id) ? " active" : ""}`}
                    type="button"
                    onClick={() => toggleDependency(task.id)}
                  >
                    {task.code}
                  </button>
                ))}
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              <Plus size={18} aria-hidden="true" />
              <span>{saving ? "创建中" : "创建任务"}</span>
            </button>
          </form>
        ) : (
          <StateBlock type="empty" title="你当前没有创建任务权限" />
        )}
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>任务看板</h3>
          <span>{taskBoard?.items.length ?? 0} 个任务</span>
        </div>
        <div className="task-board">
          {boardColumns.map((status) => (
            <div className="task-column" key={status}>
              <div className="task-column-title">
                <span>{TASK_STATUS_LABELS[status]}</span>
                <strong>{taskBoard?.board[status]?.length ?? 0}</strong>
              </div>
              {(taskBoard?.board[status] ?? []).length === 0 ? (
                <div className="task-empty">暂无任务</div>
              ) : (
                taskBoard?.board[status].map((task) => (
                  <article className={`task-card${task.overdue ? " overdue" : ""}`} key={task.id}>
                    <div className="task-card-title">
                      <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                      {task.status === "BLOCKED" ? <AlertTriangle size={16} aria-hidden="true" /> : null}
                    </div>
                    <span className="muted-text">
                      {task.code} · {TASK_TYPE_LABELS[task.taskType]} · {task.assignee?.displayName ?? "未指派"}
                    </span>
                    <div className="task-card-meta">
                      <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>
                        {REQUIREMENT_PRIORITY_LABELS[task.priority]}
                      </span>
                      <span>
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                    {task.blockerReason ? <p className="task-blocker">{task.blockerReason}</p> : null}
                    {task.dependencies.length > 0 ? (
                      <div className="task-dependency-line">
                        依赖 {task.dependencies.map((dependency) => dependency.code).join("、")}
                      </div>
                    ) : null}
                    <div className="row-actions task-card-actions">
                      {task.availableActions.includes("updateStatus")
                        ? nextStatuses(task.status).map((nextStatus) => (
                            <button
                              className="ghost-button"
                              type="button"
                              key={nextStatus}
                              disabled={savingTaskId === task.id}
                              onClick={() => void handleTaskStatus(task, nextStatus)}
                            >
                              {nextStatus === "DONE" ? (
                                <CheckCircle2 size={15} aria-hidden="true" />
                              ) : (
                                <ArrowRight size={15} aria-hidden="true" />
                              )}
                              <span>{TASK_STATUS_LABELS[nextStatus]}</span>
                            </button>
                          ))
                        : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
