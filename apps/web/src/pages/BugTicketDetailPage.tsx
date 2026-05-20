import type { BugTicketView } from "@collab/shared";
import {
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  REQUIREMENT_PRIORITY_LABELS
} from "@collab/shared";
import { ArrowLeft, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function BugTicketDetailPage() {
  const { id } = useParams();
  const [bugTicket, setBugTicket] = useState<BugTicketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBugTicket = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setBugTicket(await apiClient.bugTicket(id));
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "bug单详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadBugTicket();
  }, [loadBugTicket]);

  if (loading) {
    return (
      <div className="page-content bug-page">
        <StateBlock type="loading" title="正在加载bug单详情" />
      </div>
    );
  }

  if (!bugTicket) {
    return (
      <div className="page-content bug-page">
        <StateBlock type="error" title={error ?? "bug单不存在"} />
      </div>
    );
  }

  return (
    <div className="page-content bug-page">
      <section className="content-band requirement-detail-header">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{bugTicket.code}</span>
            <h2>{bugTicket.title}</h2>
          </div>
          <div className="row-actions">
            <Link className="ghost-button" to="/defects">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回列表</span>
            </Link>
            {bugTicket.availableActions.includes("edit") ? (
              <Link className="primary-button inline-action" to={`/defects/${bugTicket.id}/edit`}>
                <Pencil size={16} aria-hidden="true" />
                <span>编辑</span>
              </Link>
            ) : null}
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="detail-grid">
          <div className="detail-field">
            <span>状态</span>
            <strong>{BUG_STATUS_LABELS[bugTicket.status]}</strong>
          </div>
          <div className="detail-field">
            <span>严重等级</span>
            <strong>{BUG_SEVERITY_LABELS[bugTicket.severity]}</strong>
          </div>
          <div className="detail-field">
            <span>优先级</span>
            <strong>{REQUIREMENT_PRIORITY_LABELS[bugTicket.priority]}</strong>
          </div>
          <div className="detail-field">
            <span>创建时间</span>
            <strong>{formatDateTime(bugTicket.createdAt)}</strong>
          </div>
          <div className="detail-field">
            <span>发现人</span>
            <strong>{bugTicket.finder?.displayName ?? "-"}</strong>
          </div>
          <div className="detail-field">
            <span>处理人</span>
            <strong>{bugTicket.handler?.displayName ?? "-"}</strong>
          </div>
          <div className="detail-field">
            <span>bug关联人</span>
            <strong>
              {bugTicket.relatedUsers.length > 0
                ? bugTicket.relatedUsers.map((user) => user.displayName).join("、")
                : "-"}
            </strong>
          </div>
          <div className="detail-field">
            <span>更新时间</span>
            <strong>{formatDateTime(bugTicket.updatedAt)}</strong>
          </div>
          <div className="detail-field">
            <span>关联需求</span>
            {bugTicket.requirement ? (
              <Link className="text-link" to={`/requirements/${bugTicket.requirement.id}`}>
                {bugTicket.requirement.code} · {bugTicket.requirement.title}
              </Link>
            ) : (
              <strong>-</strong>
            )}
          </div>
          <div className="detail-field">
            <span>对应项目</span>
            {bugTicket.project ? (
              <Link className="text-link" to={`/projects/${bugTicket.project.id}`}>
                {bugTicket.project.code} · {bugTicket.project.name}
              </Link>
            ) : (
              <strong>-</strong>
            )}
          </div>
        </div>
      </section>

      <section className="content-band narrative-section">
        <article>
          <h4>bug描述</h4>
          <p>{bugTicket.description || "暂无描述"}</p>
        </article>
      </section>
    </div>
  );
}
