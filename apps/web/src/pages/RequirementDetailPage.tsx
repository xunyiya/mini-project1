import type {
  DepartmentWithLeader,
  RequirementPriority,
  RequirementProjectMemberRole,
  RequirementReviewSummary,
  RequirementStatus,
  RequirementStatusHistory,
  RequirementType,
  RequirementView,
  SafeUser,
  SubmitReviewInput,
  WorkflowTemplate
} from "@collab/shared";
import {
  REQUIREMENT_PROJECT_MEMBER_ROLE_LABELS,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_SOURCE_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
  REVIEW_FLOW_STATUS_LABELS,
  REVIEW_NODE_STATUS_LABELS,
  REVIEW_NODE_TYPE_LABELS
} from "@collab/shared";
import { ArrowLeft, Edit3, FolderKanban, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ReviewNodeActions } from "../components/ReviewNodeActions";
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

function FieldItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const reviewDepartmentByNodeType: Record<string, string> = {
  PRODUCT: "dept_product",
  TECH: "dept_platform",
  TEST: "dept_quality",
  OPERATION: "dept_business"
};

const projectMemberRoleOrder: RequirementProjectMemberRole[] = [
  "FRONTEND",
  "BACKEND",
  "TEST",
  "PRODUCT",
  "UI_DESIGN",
  "OTHER"
];

const requirementLifecycleSteps: RequirementStatus[] = [
  "APPROVED",
  "SCHEDULED",
  "PLANNING_DONE",
  "UI_DESIGNING",
  "UI_DESIGN_DONE",
  "IN_DEVELOPMENT",
  "DEVELOPMENT_DONE",
  "IN_TESTING",
  "TESTING_DONE",
  "ACCEPTANCE",
  "ACCEPTANCE_DONE",
  "DELIVERED",
  "ARCHIVED"
];

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <section className="content-band">
      <div className="section-heading">
        <h3>{title}</h3>
      </div>
      <div className="soft-empty">暂无内容，后续流程阶段补充。</div>
    </section>
  );
}

export function RequirementDetailPage() {
  const { id } = useParams();
  const [requirement, setRequirement] = useState<RequirementView | null>(null);
  const [histories, setHistories] = useState<RequirementStatusHistory[]>([]);
  const [reviewSummary, setReviewSummary] = useState<RequirementReviewSummary>({
    flow: null,
    nodes: []
  });
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [showStartReview, setShowStartReview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [approverAssignments, setApproverAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"submit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [detail, historyItems, reviews, userPage, departmentPage, workflowTemplates] = await Promise.all([
        apiClient.requirement(id),
        apiClient.requirementHistory(id),
        apiClient.requirementReviews(id),
        apiClient.users(1, 100),
        apiClient.departments(1, 100),
        apiClient.workflowTemplates("REQUIREMENT")
      ]);
      setRequirement(detail);
      setHistories(historyItems);
      setReviewSummary(reviews);
      setUsers(userPage.items);
      setDepartments(departmentPage.items);
      setTemplates(workflowTemplates);
      setSelectedTemplateId(workflowTemplates.find((template) => template.isDefault)?.id ?? "");
      setApproverAssignments(detail.reviewApproverAssignments ?? {});
    } catch (caughtError) {
      const message = caughtError instanceof ApiClientError ? caughtError.message : "需求详情加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmitReview(input: SubmitReviewInput = {}) {
    if (!requirement) {
      return;
    }

    setSaving("submit");
    setError(null);

    try {
      await apiClient.submitRequirementReview(requirement.id, input);
      await loadData();
      setShowStartReview(false);
    } catch (caughtError) {
      const message = caughtError instanceof ApiClientError ? caughtError.message : "提交评审失败";
      setError(message);
    } finally {
      setSaving(null);
    }
  }

  function buildStartReviewInput(): SubmitReviewInput {
    return {
      templateId: selectedTemplateId || undefined,
      reviewKind: requirement?.pendingChangeReview ? "CHANGE" : undefined,
      nodeTypes: requirement?.pendingChangeReview?.nodeTypes,
      approverAssignments: Object.fromEntries(
        Object.entries(approverAssignments).filter(([, userId]) => Boolean(userId))
      )
    };
  }

  async function handleWithdraw() {
    if (!requirement) {
      return;
    }

    setSaving("withdraw");
    setError(null);

    try {
      const updatedRequirement = await apiClient.withdrawRequirement(requirement.id);
      const historyItems = await apiClient.requirementHistory(requirement.id);
      setRequirement(updatedRequirement);
      setHistories(historyItems);
    } catch (caughtError) {
      const message = caughtError instanceof ApiClientError ? caughtError.message : "撤回需求失败";
      setError(message);
    } finally {
      setSaving(null);
    }
  }

  function userLabel(userId: string) {
    const user = users.find((item) => item.id === userId);
    return user ? `${user.displayName}（${user.username} · ${user.title}）` : userId;
  }

  function projectMemberSummary() {
    if (!requirement || requirement.projectMembers.length === 0) {
      return "-";
    }

    return projectMemberRoleOrder
      .flatMap((role) =>
        requirement.projectMembers
          .filter((member) => member.role === role)
          .map((member) => `${REQUIREMENT_PROJECT_MEMBER_ROLE_LABELS[role]}：${userLabel(member.userId)}`)
      )
      .join("；");
  }

  function lifecycleIndex() {
    const currentStatus = requirement?.pendingChangeReview?.returnStatus ?? requirement?.status;
    return requirementLifecycleSteps.findIndex((status) => status === currentStatus);
  }

  function leadersForReviewNode(nodeType: string, defaultDepartmentId?: string) {
    const departmentId = defaultDepartmentId ?? reviewDepartmentByNodeType[nodeType];
    const department = departments.find((item) => item.id === departmentId);
    return department?.leaders ?? [];
  }

  if (loading) {
    return (
      <div className="page-content">
        <StateBlock type="loading" title="正在加载需求详情" />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="page-content">
        <StateBlock type="error" title="需求详情不可用" description={error ?? "请返回需求池重试"} />
      </div>
    );
  }

  return (
    <div className="page-content requirements-page">
      <section className="content-band requirement-detail-header">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{requirement.code}</span>
            <h2>{requirement.title}</h2>
          </div>
          <div className="row-actions">
            <Link className="ghost-button" to="/requirements">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回列表</span>
            </Link>
            {requirement.availableActions.includes("edit") ? (
              <Link className="ghost-button" to={`/requirements/${requirement.id}/edit`}>
                <Edit3 size={16} aria-hidden="true" />
                <span>编辑</span>
              </Link>
            ) : null}
            {requirement.availableActions.includes("submitReview") ? (
              <button
                className="primary-button inline-action"
                type="button"
                disabled={Boolean(saving)}
                onClick={() => setShowStartReview(true)}
              >
                <Send size={16} aria-hidden="true" />
                <span>{saving === "submit" ? "提交中" : requirement.pendingChangeReview ? "发起二次评审" : "发起评审"}</span>
              </button>
            ) : null}
            {requirement.status === "APPROVED" ? (
              <Link className="primary-button inline-action" to={`/projects?requirementId=${requirement.id}`}>
                <FolderKanban size={16} aria-hidden="true" />
                <span>创建项目</span>
              </Link>
            ) : null}
            {requirement.availableActions.includes("withdraw") ? (
              <button
                className="danger-button"
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void handleWithdraw()}
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>{saving === "withdraw" ? "撤回中" : "撤回"}</span>
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="requirement-badges">
          <span className={`status-pill requirement-status status-${requirement.status.toLowerCase()}`}>
            {REQUIREMENT_STATUS_LABELS[requirement.status as RequirementStatus]}
          </span>
          {requirement.priority ? (
            <span className={`priority-pill priority-${requirement.priority.toLowerCase()}`}>
              {REQUIREMENT_PRIORITY_LABELS[requirement.priority as RequirementPriority]}
            </span>
          ) : null}
          {requirement.type ? (
            <span className="type-pill">
              {REQUIREMENT_TYPE_LABELS[requirement.type as RequirementType]}
            </span>
          ) : null}
        </div>
        {lifecycleIndex() >= 0 ? (
          <div className="requirement-lifecycle" aria-label="需求交付状态">
            {requirementLifecycleSteps.map((status, index) => (
              <span
                className={`lifecycle-step${index <= lifecycleIndex() ? " done" : ""}${index === lifecycleIndex() ? " active" : ""}`}
                key={status}
              >
                {REQUIREMENT_STATUS_LABELS[status]}
              </span>
            ))}
          </div>
        ) : null}
        {requirement.pendingChangeReview ? (
          <div className="form-success">
            已产生内容变更，需发起二次评审；审批节点：
            {requirement.pendingChangeReview.nodeTypes
              .map((nodeType) => REVIEW_NODE_TYPE_LABELS[nodeType])
              .join("、")}
          </div>
        ) : null}
      </section>

      <section className="content-band">
        <div className="section-heading">
          <div>
            <h3>评审记录</h3>
            {reviewSummary.flow ? (
              <span>
                {reviewSummary.flow.template?.name ?? "未指定模板"} ·{" "}
                {REVIEW_FLOW_STATUS_LABELS[reviewSummary.flow.status]}
              </span>
            ) : (
              <span>暂无评审流</span>
            )}
          </div>
        </div>
        {reviewSummary.nodes.length === 0 ? (
          <div className="soft-empty">暂无评审记录。</div>
        ) : (
          <div className="review-node-list">
            {reviewSummary.nodes.map((node) => (
              <article className="review-node-row" key={node.id}>
                <div>
                  <strong>{node.nodeName}</strong>
                  <span>
                    {REVIEW_NODE_TYPE_LABELS[node.nodeType]} · {node.approver.displayName}
                  </span>
                </div>
                <span className={`status-pill review-node-status status-${node.status.toLowerCase()}`}>
                  {REVIEW_NODE_STATUS_LABELS[node.status]}
                </span>
                <div className="review-comment">
                  <span>{node.comment || "暂无意见"}</span>
                  <small>{node.handledAt ? formatDateTime(node.handledAt) : "未处理"}</small>
                </div>
                <ReviewNodeActions node={node} users={users} onDone={() => void loadData()} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>基本信息</h3>
        </div>
        <div className="detail-grid">
          <FieldItem label="需求来源" value={requirement.source ? REQUIREMENT_SOURCE_LABELS[requirement.source] : "-"} />
          <FieldItem label="提出部门" value={requirement.department?.name} />
          <FieldItem label="提交人" value={`${requirement.submitter.displayName}（${requirement.submitter.username}）`} />
          <FieldItem
            label="需求跟进人"
            value={
              requirement.owner
                ? `${requirement.owner.displayName}（${requirement.owner.username}）`
                : "-"
            }
          />
          <FieldItem label="期望上线" value={formatDateTime(requirement.expectedReleaseDate)} />
          <FieldItem label="提交时间" value={formatDateTime(requirement.submittedAt)} />
          <FieldItem
            label="相关部门"
            value={requirement.relatedDepartmentInfos.map((department) => department.name).join("、")}
          />
          <FieldItem label="项目相关人" value={projectMemberSummary()} />
          <FieldItem label="更新时间" value={formatDateTime(requirement.updatedAt)} />
        </div>
      </section>

      <section className="content-band narrative-section">
        <div className="section-heading">
          <h3>需求内容</h3>
        </div>
        <article>
          <h4>需求描述</h4>
          <p>{requirement.description || "-"}</p>
        </article>
        <article>
          <h4>业务背景</h4>
          <p>{requirement.background || "-"}</p>
        </article>
        <article>
          <h4>需求目标</h4>
          <p>{requirement.goal || "-"}</p>
        </article>
        <article>
          <h4>影响范围</h4>
          <p>{requirement.impactScope || "-"}</p>
        </article>
        <article>
          <h4>成功指标</h4>
          <p>{requirement.successMetric || "-"}</p>
        </article>
        <article>
          <h4>附件</h4>
          {requirement.attachments.length > 0 ? (
            <div className="attachment-list">
              {requirement.attachments.map((attachment) => (
                <a key={`${attachment.name}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer">
                  {attachment.name}
                </a>
              ))}
            </div>
          ) : (
            <p>-</p>
          )}
        </article>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h3>状态流转历史</h3>
        </div>
        <div className="timeline">
          {histories.map((history) => (
            <div className="timeline-item" key={history.id}>
              <span />
              <div>
                <strong>
                  {history.fromStatus ? `${REQUIREMENT_STATUS_LABELS[history.fromStatus]} → ` : ""}
                  {REQUIREMENT_STATUS_LABELS[history.toStatus]}
                </strong>
                <p>
                  {history.reason} · {formatDateTime(history.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="placeholder-grid">
        <PlaceholderPanel title="关联任务" />
        <PlaceholderPanel title="变更记录" />
        <PlaceholderPanel title="评论附件" />
      </div>

      {showStartReview ? (
        <div className="modal-backdrop" role="presentation">
          <section className="action-dialog start-review-dialog" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{requirement.code}</span>
                <h3>发起需求评审</h3>
              </div>
            </div>
            <label>
              <span>流程模板</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => {
                  setSelectedTemplateId(event.target.value);
                  setApproverAssignments({});
                }}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="template-node-assignment">
              {[...(templates.find((template) => template.id === selectedTemplateId)?.nodesConfig ?? [])]
                .sort((left, right) => left.orderIndex - right.orderIndex)
                .map((node) => {
                  const leaders = leadersForReviewNode(node.nodeType, node.defaultDepartmentId);

                  return (
                    <label key={node.nodeType}>
                      <span>{node.nodeName}</span>
                      <select
                        value={approverAssignments[node.nodeType] ?? node.defaultApproverUserId ?? ""}
                        onChange={(event) =>
                          setApproverAssignments({
                            ...approverAssignments,
                            [node.nodeType]: event.target.value
                          })
                        }
                      >
                        <option value="">按模板默认评审人</option>
                        {leaders.map((leader) => (
                          <option key={leader.id} value={leader.id}>
                            {leader.displayName}（{leader.username} · {leader.title}）
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
            </div>
            <div className="form-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={Boolean(saving)}
                onClick={() => setShowStartReview(false)}
              >
                取消
              </button>
              <button
                className="primary-button inline-action"
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void handleSubmitReview(buildStartReviewInput())}
              >
                {saving === "submit" ? "提交中" : "确认发起"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
