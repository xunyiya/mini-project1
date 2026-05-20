import type {
  BugStatus,
  BugTicketCreateInput,
  BugTicketUpdateInput,
  BugTicketView,
  ProjectView,
  RequirementView,
  SafeUser
} from "@collab/shared";
import {
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  BUG_STATUSES,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS
} from "@collab/shared";
import { ChevronDown, Save, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export type BugFormState = {
  title: string;
  severity: string;
  priority: string;
  status: string;
  requirementId: string;
  projectId: string;
  finderId: string;
  handlerId: string;
  relatedUserIds: string[];
  description: string;
};

export const defaultBugForm: BugFormState = {
  title: "",
  severity: "S3",
  priority: "P2",
  status: "CREATED",
  requirementId: "",
  projectId: "",
  finderId: "",
  handlerId: "",
  relatedUserIds: [],
  description: ""
};

export function userLabel(user: Pick<SafeUser, "username" | "displayName" | "title">) {
  return `${user.displayName}（${user.username} · ${user.title}）`;
}

export function bugFormFromTicket(bugTicket: BugTicketView): BugFormState {
  return {
    title: bugTicket.title,
    severity: bugTicket.severity,
    priority: bugTicket.priority,
    status: bugTicket.status,
    requirementId: bugTicket.requirementId,
    projectId: bugTicket.projectId,
    finderId: bugTicket.finderId,
    handlerId: bugTicket.handlerId,
    relatedUserIds: bugTicket.relatedUserIds,
    description: bugTicket.description
  };
}

export function buildBugPayload(form: BugFormState): BugTicketCreateInput | BugTicketUpdateInput {
  return {
    title: form.title,
    severity: form.severity as BugTicketCreateInput["severity"],
    priority: form.priority as BugTicketCreateInput["priority"],
    status: form.status as BugStatus,
    requirementId: form.requirementId,
    projectId: form.projectId,
    finderId: form.finderId,
    handlerId: form.handlerId,
    relatedUserIds: form.relatedUserIds,
    description: form.description
  };
}

type BugTicketFormProps = {
  form: BugFormState;
  users: SafeUser[];
  requirements: RequirementView[];
  projects: ProjectView[];
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
  onChange: (form: BugFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function BugTicketForm({
  form,
  users,
  requirements,
  projects,
  saving,
  submitLabel,
  onCancel,
  onChange,
  onSubmit
}: BugTicketFormProps) {
  const [relatedUsersOpen, setRelatedUsersOpen] = useState(false);
  const projectOptions = useMemo(
    () =>
      form.requirementId
        ? projects.filter((project) => project.requirementId === form.requirementId)
        : projects,
    [form.requirementId, projects]
  );
  const relatedUserSummary = useMemo(() => {
    const selectedUsers = users
      .filter((user) => form.relatedUserIds.includes(user.id))
      .map((user) => user.displayName);

    if (selectedUsers.length === 0) {
      return "请选择bug关联人";
    }

    if (selectedUsers.length <= 3) {
      return selectedUsers.join("、");
    }

    return `${selectedUsers.slice(0, 3).join("、")} 等 ${selectedUsers.length} 人`;
  }, [form.relatedUserIds, users]);

  function handleRequirementChange(requirementId: string) {
    const currentProject = projects.find((project) => project.id === form.projectId);

    onChange({
      ...form,
      requirementId,
      projectId: currentProject?.requirementId === requirementId ? form.projectId : ""
    });
  }

  function toggleRelatedUser(userId: string, checked: boolean) {
    const selectedUserIds = new Set(form.relatedUserIds);

    if (checked) {
      selectedUserIds.add(userId);
    } else {
      selectedUserIds.delete(userId);
    }

    onChange({
      ...form,
      relatedUserIds: users
        .map((user) => user.id)
        .filter((id) => selectedUserIds.has(id))
    });
  }

  return (
    <form className="bug-ticket-form" onSubmit={onSubmit}>
      <div className="form-grid two-columns">
        <label className="wide-field">
          <span>标题</span>
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label>
          <span>严重等级</span>
          <select
            value={form.severity}
            onChange={(event) => onChange({ ...form, severity: event.target.value })}
            required
          >
            {BUG_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {BUG_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select
            value={form.priority}
            onChange={(event) => onChange({ ...form, priority: event.target.value })}
            required
          >
            {REQUIREMENT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {REQUIREMENT_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            value={form.status}
            onChange={(event) => onChange({ ...form, status: event.target.value })}
            required
          >
            {BUG_STATUSES.map((status) => (
              <option key={status} value={status}>
                {BUG_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>关联需求</span>
          <select
            value={form.requirementId}
            onChange={(event) => handleRequirementChange(event.target.value)}
            required
          >
            <option value="">请选择</option>
            {requirements.map((requirement) => (
              <option key={requirement.id} value={requirement.id}>
                {requirement.code} · {requirement.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>对应项目</span>
          <select
            value={form.projectId}
            onChange={(event) => onChange({ ...form, projectId: event.target.value })}
            required
          >
            <option value="">请选择</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>发现人</span>
          <select
            value={form.finderId}
            onChange={(event) => onChange({ ...form, finderId: event.target.value })}
            required
          >
            <option value="">请选择</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {userLabel(user)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>处理人</span>
          <select
            value={form.handlerId}
            onChange={(event) => onChange({ ...form, handlerId: event.target.value })}
            required
          >
            <option value="">请选择</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {userLabel(user)}
              </option>
            ))}
          </select>
        </label>
        <div className="wide-field related-user-picker">
          <span>bug关联人</span>
          <div className={`department-dropdown${relatedUsersOpen ? " open" : ""}`}>
            <button
              className="department-dropdown-trigger"
              type="button"
              disabled={users.length === 0}
              aria-expanded={relatedUsersOpen}
              aria-controls="bug-related-users-panel"
              onClick={() => setRelatedUsersOpen((open) => !open)}
            >
              <span>{relatedUserSummary}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {relatedUsersOpen ? (
              <div
                className="department-check-list"
                id="bug-related-users-panel"
                role="group"
                aria-label="bug关联人"
              >
                {users.map((user) => {
                  const checked = form.relatedUserIds.includes(user.id);

                  return (
                    <label
                      className={`department-check${checked ? " selected" : ""}`}
                      key={user.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleRelatedUser(user.id, event.target.checked)}
                      />
                      <span>{userLabel(user)}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <label className="wide-field">
          <span>bug描述</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          <span>取消</span>
        </button>
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={18} aria-hidden="true" />
          <span>{saving ? "保存中" : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
