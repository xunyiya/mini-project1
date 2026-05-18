import type { RequirementReviewSummary, ReviewNodeView, SafeUser } from "@collab/shared";
import { CheckCircle2, Forward, MessageSquareWarning, XCircle } from "lucide-react";
import { useState } from "react";
import { ApiClientError, apiClient } from "../lib/api";

type ReviewAction = "approve" | "reject" | "requestSupplement" | "transfer";

type ReviewNodeActionsProps = {
  node: ReviewNodeView;
  users: SafeUser[];
  onDone: (summary: RequirementReviewSummary) => void;
};

const actionMeta: Record<
  ReviewAction,
  {
    label: string;
    title: string;
    description: string;
    buttonClass: string;
  }
> = {
  approve: {
    label: "通过",
    title: "确认通过评审",
    description: "通过后将进入下一个评审节点，若这是最后一个必需节点，需求会变为已通过。",
    buttonClass: "ghost-button"
  },
  reject: {
    label: "驳回",
    title: "确认驳回需求",
    description: "驳回后评审流会终止，需求状态变为已驳回。",
    buttonClass: "danger-button"
  },
  requestSupplement: {
    label: "要求补充",
    title: "确认要求补充",
    description: "提交后评审流会暂停，需求状态变为需补充。",
    buttonClass: "ghost-button"
  },
  transfer: {
    label: "转派",
    title: "确认转派评审",
    description: "当前节点会记录转派原因，并由新的评审人继续处理。",
    buttonClass: "ghost-button"
  }
};

function iconForAction(action: ReviewAction) {
  if (action === "approve") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }

  if (action === "transfer") {
    return <Forward size={16} aria-hidden="true" />;
  }

  if (action === "reject") {
    return <XCircle size={16} aria-hidden="true" />;
  }

  return <MessageSquareWarning size={16} aria-hidden="true" />;
}

export function ReviewNodeActions({ node, users, onDone }: ReviewNodeActionsProps) {
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [comment, setComment] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (node.availableActions.length === 0) {
    return null;
  }

  function closeDialog() {
    setAction(null);
    setComment("");
    setTargetUserId("");
    setError(null);
  }

  async function handleConfirm() {
    if (!action) {
      return;
    }

    if ((action === "reject" || action === "requestSupplement") && !comment.trim()) {
      setError("请填写原因");
      return;
    }

    if (action === "transfer" && (!targetUserId || !comment.trim())) {
      setError("请选择转派目标并填写原因");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result =
        action === "approve"
          ? await apiClient.approveReviewNode(node.id, { comment })
          : action === "reject"
            ? await apiClient.rejectReviewNode(node.id, { comment })
            : action === "requestSupplement"
              ? await apiClient.requestSupplementReviewNode(node.id, { comment })
              : await apiClient.transferReviewNode(node.id, {
                  targetUserId,
                  reason: comment
                });

      onDone(result);
      closeDialog();
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "评审操作失败";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="row-actions">
        {node.availableActions.map((availableAction) => (
          <button
            key={availableAction}
            className={actionMeta[availableAction].buttonClass}
            type="button"
            onClick={() => setAction(availableAction)}
          >
            {iconForAction(availableAction)}
            <span>{actionMeta[availableAction].label}</span>
          </button>
        ))}
      </div>

      {action ? (
        <div className="modal-backdrop" role="presentation">
          <section className="action-dialog" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{node.nodeName}</span>
                <h3>{actionMeta[action].title}</h3>
              </div>
            </div>
            <p className="muted-text">{actionMeta[action].description}</p>
            {action === "transfer" ? (
              <label>
                <span>转派给</span>
                <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
                  <option value="">请选择评审人</option>
                  {users
                    .filter((user) => user.id !== node.approverId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}（{user.username} · {user.title}）
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>{action === "approve" ? "意见" : "原因"}</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder={action === "approve" ? "可填写评审意见" : "请填写原因"}
              />
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={closeDialog} disabled={saving}>
                取消
              </button>
              <button
                className={action === "reject" ? "danger-button" : "primary-button inline-action"}
                type="button"
                onClick={() => void handleConfirm()}
                disabled={saving}
              >
                {saving ? "处理中" : "确认"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
