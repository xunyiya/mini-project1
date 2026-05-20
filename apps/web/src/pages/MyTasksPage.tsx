import type {
  ProjectOption,
  RequirementPriority,
  RequirementStatus,
  RequirementTaskBoard,
  RequirementTaskBoardColumn,
  RequirementTaskBoardItem,
  RequirementType
} from "@collab/shared";
import {
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
  REVIEW_NODE_STATUS_LABELS
} from "@collab/shared";
import { Archive, ClipboardList, Clock3, Eye, FolderKanban, PackageCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

const emptyBoard: RequirementTaskBoard = {
  columns: {
    TODO: [],
    IN_PROGRESS: [],
    DELIVERED: [],
    ARCHIVED: []
  },
  counts: {
    TODO: 0,
    IN_PROGRESS: 0,
    DELIVERED: 0,
    ARCHIVED: 0
  }
};

const boardColumns: Array<{
  key: RequirementTaskBoardColumn;
  title: string;
  description: string;
  Icon: typeof ClipboardList;
}> = [
  {
    key: "TODO",
    title: "待办项",
    description: "待我审核，或需要我跟进的已通过需求",
    Icon: ClipboardList
  },
  {
    key: "IN_PROGRESS",
    title: "进行中",
    description: "与我相关，但还未到我的处理环节",
    Icon: Clock3
  },
  {
    key: "DELIVERED",
    title: "已交付",
    description: "与我相关，且我的环节已经完成",
    Icon: PackageCheck
  },
  {
    key: "ARCHIVED",
    title: "已归档",
    description: "与我相关，且项目已经归档",
    Icon: Archive
  }
];

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );
}

function BoardCard({ item }: { item: RequirementTaskBoardItem }) {
  return (
    <article className="requirement-task-card">
      <div className="task-card-title">
        <Link to={`/requirements/${item.requirement.id}`}>{item.requirement.title}</Link>
      </div>
      <span className="muted-text">
        {item.requirement.code} · 更新 {formatDate(item.requirement.updatedAt)}
      </span>
      <div className="task-board-badges">
        <span className={`status-pill requirement-status status-${item.requirement.status.toLowerCase()}`}>
          {REQUIREMENT_STATUS_LABELS[item.requirement.status as RequirementStatus]}
        </span>
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
      <div className="task-board-meta">
        <strong>{item.actionText}</strong>
        {item.currentNode ? (
          <span>
            {item.currentNode.nodeName} · {REVIEW_NODE_STATUS_LABELS[item.currentNode.status]} · 到期{" "}
            {formatDate(item.currentNode.dueAt)}
          </span>
        ) : (
          <span>期望上线 {formatDate(item.requirement.expectedReleaseDate)}</span>
        )}
      </div>
      <div className="filter-chip-group compact-chip-group">
        {item.relationLabels.map((label) => (
          <span className="filter-chip readonly" key={label}>
            {label}
          </span>
        ))}
      </div>
      <div className="row-actions task-card-actions">
        <Link className="ghost-button" to={`/requirements/${item.requirement.id}`}>
          <Eye size={16} aria-hidden="true" />
          <span>需求</span>
        </Link>
        {item.project ? (
          <Link className="ghost-button" to={`/projects/${item.project.id}`}>
            <FolderKanban size={16} aria-hidden="true" />
            <span>项目</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function MyTasksPage() {
  const [board, setBoard] = useState<RequirementTaskBoard>(emptyBoard);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setBoard(await apiClient.requirementTaskBoard({ projectId }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "任务看板加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    void apiClient.projectOptions().then(setProjects).catch(() => {
      setError("项目选项加载失败");
    });
  }, []);

  const total = Object.values(board.counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="page-content tasks-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">任务看板</span>
            <h2>我的需求协同事项</h2>
          </div>
          <div className="row-actions">
            <label className="inline-select-field">
              <span>项目</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">全部项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} · {project.name}
                  </option>
                ))}
              </select>
            </label>
            <span>共 {total} 项</span>
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      <section className="content-band">
        {loading ? (
          <StateBlock type="loading" title="正在加载任务看板" />
        ) : total === 0 ? (
          <StateBlock type="empty" title="暂无与你相关的需求协同事项" />
        ) : (
          <div className="requirement-task-board">
            {boardColumns.map(({ key, title, description, Icon }) => (
              <section className="requirement-task-column" key={key}>
                <div className="requirement-task-column-title">
                  <div>
                    <Icon size={18} aria-hidden="true" />
                    <strong>{title}</strong>
                  </div>
                  <span>{board.counts[key]}</span>
                </div>
                <p>{description}</p>
                {board.columns[key].length === 0 ? (
                  <div className="task-empty">暂无事项</div>
                ) : (
                  board.columns[key].map((item) => <BoardCard item={item} key={item.id} />)
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
