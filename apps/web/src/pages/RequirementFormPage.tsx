import type {
  DepartmentWithLeader,
  RequirementAttachment,
  RequirementCreateInput,
  RequirementPriority,
  RequirementProjectMemberRole,
  RequirementSource,
  RequirementStatus,
  RequirementType,
  RequirementUpdateInput,
  RequirementView,
  ReviewNodeType,
  SafeUser
} from "@collab/shared";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PROJECT_MEMBER_ROLE_LABELS,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_SOURCE_LABELS,
  REQUIREMENT_SOURCES,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPES
} from "@collab/shared";
import { ArrowLeft, Save, Send } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StateBlock } from "../components/StateBlock";
import { ApiClientError, apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type RequirementFormPageProps = {
  mode: "new" | "edit";
};

type RequirementFormState = {
  title: string;
  description: string;
  background: string;
  goal: string;
  source: string;
  type: string;
  priority: string;
  status: string;
  departmentId: string;
  ownerId: string;
  expectedReleaseDate: string;
  relatedDepartments: string[];
  impactScope: string;
  successMetric: string;
  attachmentsText: string;
  reviewApproverAssignments: Record<string, string>;
  projectMembers: Record<RequirementProjectMemberRole, string[]>;
};

type FieldErrors = Record<string, string[]>;

const reviewApproverFields: Array<{
  nodeType: ReviewNodeType;
  label: string;
  departmentId: string;
}> = [
  { nodeType: "PRODUCT", label: "产品审批", departmentId: "dept_product" },
  { nodeType: "TECH", label: "技术审批", departmentId: "dept_platform" },
  { nodeType: "TEST", label: "测试审批", departmentId: "dept_quality" },
  { nodeType: "OPERATION", label: "运营/相关方确认", departmentId: "dept_business" }
];

const projectMemberRoles: RequirementProjectMemberRole[] = [
  "FRONTEND",
  "BACKEND",
  "TEST",
  "PRODUCT",
  "UI_DESIGN",
  "OTHER"
];

const followerOnlyStatuses: RequirementStatus[] = [
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
  "PENDING_RELEASE",
  "RELEASED",
  "DELIVERED",
  "ARCHIVED"
];

function emptyProjectMemberMap(): Record<RequirementProjectMemberRole, string[]> {
  return {
    FRONTEND: [],
    BACKEND: [],
    TEST: [],
    PRODUCT: [],
    UI_DESIGN: [],
    OTHER: []
  };
}

const emptyForm: RequirementFormState = {
  title: "",
  description: "",
  background: "",
  goal: "",
  source: "",
  type: "",
  priority: "",
  status: "DRAFT",
  departmentId: "",
  ownerId: "",
  expectedReleaseDate: "",
  relatedDepartments: [],
  impactScope: "",
  successMetric: "",
  attachmentsText: "",
  reviewApproverAssignments: {},
  projectMembers: emptyProjectMemberMap()
};

function attachmentLines(attachments: RequirementAttachment[]) {
  return attachments.map((attachment) => `${attachment.name}|${attachment.url}`).join("\n");
}

function parseAttachments(value: string): RequirementAttachment[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...urlParts] = line.split("|");
      const url = urlParts.join("|").trim();

      return {
        name: name.trim(),
        url: url || name.trim()
      };
    });
}

function defaultReviewAssignments(
  departments: DepartmentWithLeader[],
  currentUserId?: string
): Record<string, string> {
  return Object.fromEntries(
    reviewApproverFields.map((field) => {
      const department = departments.find((item) => item.id === field.departmentId);
      const leader =
        department?.leaders.find((item) => item.id !== currentUserId) ?? department?.leaders[0];

      return [field.nodeType, leader?.id ?? ""];
    })
  );
}

function projectMembersFromRequirement(requirement: RequirementView) {
  const projectMembers = emptyProjectMemberMap();
  requirement.projectMembers.forEach((member) => {
    projectMembers[member.role] = Array.from(new Set([...projectMembers[member.role], member.userId]));
  });
  return projectMembers;
}

function compactProjectMembers(projectMembers: Record<RequirementProjectMemberRole, string[]>) {
  return projectMemberRoles
    .flatMap((role) =>
      projectMembers[role]
        .filter(Boolean)
        .map((userId) => ({
          role,
          userId
        }))
    );
}

function compactAssignments(assignments: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(assignments).filter(([, userId]) => Boolean(userId))
  );
}

function formFromRequirement(requirement: RequirementView): RequirementFormState {
  return {
    title: requirement.title,
    description: requirement.description,
    background: requirement.background,
    goal: requirement.goal,
    source: requirement.source ?? "",
    type: requirement.type ?? "",
    priority: requirement.priority ?? "",
    status: requirement.status,
    departmentId: requirement.departmentId ?? "",
    ownerId: requirement.ownerId ?? "",
    expectedReleaseDate: requirement.expectedReleaseDate ?? "",
    relatedDepartments: requirement.relatedDepartments,
    impactScope: requirement.impactScope,
    successMetric: requirement.successMetric ?? "",
    attachmentsText: attachmentLines(requirement.attachments),
    reviewApproverAssignments: requirement.reviewApproverAssignments ?? {},
    projectMembers: projectMembersFromRequirement(requirement)
  };
}

function getFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiClientError) || !error.data || typeof error.data !== "object") {
    return {};
  }

  const data = error.data as {
    fieldErrors?: FieldErrors;
    details?: {
      fieldErrors?: FieldErrors;
    };
  };

  return data.fieldErrors ?? data.details?.fieldErrors ?? {};
}

function fieldMessage(fieldErrors: FieldErrors, fieldName: string) {
  return fieldErrors[fieldName]?.join("；") ?? "";
}

export function RequirementFormPage({ mode }: RequirementFormPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [form, setForm] = useState<RequirementFormState>({
    ...emptyForm,
    projectMembers: emptyProjectMemberMap(),
    reviewApproverAssignments: {},
    departmentId: me?.user.departmentId ?? "",
    ownerId: me?.user.id ?? ""
  });
  const [requirement, setRequirement] = useState<RequirementView | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithLeader[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const canSubmit =
    mode === "new" ||
    requirement?.availableActions.includes("submitReview") ||
    requirement?.availableActions.includes("editCoreChange");
  const canEditRequirementFields = mode === "new" || Boolean(requirement?.availableActions.includes("edit"));
  const canEditStatus = mode === "edit" && Boolean(requirement?.availableActions.includes("updateStatus"));
  const canEdit = canEditRequirementFields || canEditStatus;
  const postApprovalMode =
    mode === "edit" &&
    Boolean(requirement) &&
    followerOnlyStatuses.includes(requirement!.status as RequirementStatus);
  const followerOnlyMode =
    postApprovalMode && canEditRequirementFields && !requirement?.availableActions.includes("editCoreChange");
  const canEditBaseFields = canEditRequirementFields && !postApprovalMode;
  const canEditContentFields =
    canEditBaseFields || Boolean(requirement?.availableActions.includes("editCoreChange"));
  const canEditPeopleFields =
    canEditBaseFields || Boolean(requirement?.availableActions.includes("editPeople"));
  const canEditFollower =
    canEditBaseFields || Boolean(requirement?.availableActions.includes("editFollower"));
  const pageTitle =
    mode === "new" ? "新建需求" : followerOnlyMode ? "变更需求相关人" : "编辑需求";

  const ownerOptions = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        label: `${user.displayName}（${user.username} · ${user.title}）`
      })),
    [users]
  );

  const statusOptions = useMemo(() => {
    if (!requirement) {
      return ["DRAFT"] as RequirementStatus[];
    }

    if (!canEditStatus) {
      return [requirement.status as RequirementStatus];
    }

    return REQUIREMENT_STATUSES;
  }, [canEditStatus, requirement]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [departmentPage, userPage, detail] = await Promise.all([
        apiClient.departments(1, 100),
        apiClient.users(1, 100),
        mode === "edit" && id ? apiClient.requirement(id) : Promise.resolve(null)
      ]);

      setDepartments(departmentPage.items);
      setUsers(userPage.items);

      if (detail) {
        setRequirement(detail);
        setForm(formFromRequirement(detail));
      } else {
        setForm((currentForm) => ({
          ...currentForm,
          reviewApproverAssignments: defaultReviewAssignments(
            departmentPage.items,
            me?.user.id
          )
        }));
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "需求表单加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, me?.user.id, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleRelatedDepartmentsChange(selectedOptions: HTMLCollectionOf<HTMLOptionElement>) {
    setForm({
      ...form,
      relatedDepartments: Array.from(selectedOptions).map((option) => option.value)
    });
  }

  function buildPayload(): RequirementCreateInput | RequirementUpdateInput {
    if (postApprovalMode) {
      return {
        ...(canEditStatus ? { status: form.status as RequirementStatus } : {}),
        ...(canEditFollower ? { ownerId: form.ownerId || undefined } : {}),
        ...(canEditPeopleFields
          ? {
              reviewApproverAssignments: compactAssignments(form.reviewApproverAssignments),
              projectMembers: compactProjectMembers(form.projectMembers)
            }
          : {}),
        ...(canEditContentFields
          ? {
              description: form.description,
              background: form.background,
              goal: form.goal,
              impactScope: form.impactScope,
              successMetric: form.successMetric,
              attachments: parseAttachments(form.attachmentsText)
            }
          : {})
      };
    }

    if (!canEditBaseFields) {
      return {
        ...(canEditStatus ? { status: form.status as RequirementStatus } : {})
      };
    }

    return {
      title: form.title,
      description: form.description,
      background: form.background,
      goal: form.goal,
      source: form.source ? (form.source as RequirementSource) : undefined,
      type: form.type ? (form.type as RequirementType) : undefined,
      priority: form.priority ? (form.priority as RequirementPriority) : undefined,
      departmentId: form.departmentId || undefined,
      ownerId: form.ownerId || undefined,
      expectedReleaseDate: form.expectedReleaseDate || undefined,
      relatedDepartments: form.relatedDepartments,
      impactScope: form.impactScope,
      successMetric: form.successMetric,
      attachments: parseAttachments(form.attachmentsText),
      reviewApproverAssignments: compactAssignments(form.reviewApproverAssignments),
      projectMembers: compactProjectMembers(form.projectMembers),
      ...(canEditStatus ? { status: form.status as RequirementStatus } : {})
    };
  }

  async function saveDraft() {
    const payload = buildPayload();

    if (mode === "new" && !requirement) {
      const createdRequirement = await apiClient.createRequirement(payload as RequirementCreateInput);
      setRequirement(createdRequirement);
      return createdRequirement;
    }

    const savedRequirement = await apiClient.updateRequirement(requirement?.id ?? id!, payload);
    setRequirement(savedRequirement);
    return savedRequirement;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setError("当前状态不允许编辑需求");
      return;
    }

    setSaving("draft");
    setError(null);
    setFieldErrors({});

    try {
      const savedRequirement = await saveDraft();
      navigate(`/requirements/${savedRequirement.id}`);
    } catch (caughtError) {
      const message = caughtError instanceof ApiClientError ? caughtError.message : "保存草稿失败";
      setError(message);
      setFieldErrors(getFieldErrors(caughtError));
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAndSubmit() {
    if (!canSubmit) {
      setError("当前状态不允许提交评审");
      return;
    }

    setSaving("submit");
    setError(null);
    setFieldErrors({});

    try {
      const savedRequirement = await saveDraft();
      const submittedRequirement = await apiClient.submitRequirementReview(savedRequirement.id, {
        reviewKind: savedRequirement.pendingChangeReview ? "CHANGE" : undefined
      });
      navigate(`/requirements/${submittedRequirement.id}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError ? caughtError.message : "保存并提交评审失败";
      setError(message);
      setFieldErrors(getFieldErrors(caughtError));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <StateBlock type="loading" title="正在加载需求表单" />
      </div>
    );
  }

  if (mode === "edit" && !requirement && error) {
    return (
      <div className="page-content">
        <StateBlock type="error" title="需求加载失败" description={error} />
      </div>
    );
  }

  return (
    <div className="page-content requirements-page">
      <section className="content-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">需求池</span>
            <h2>{pageTitle}</h2>
          </div>
          <Link className="ghost-button" to={requirement ? `/requirements/${requirement.id}` : "/requirements"}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>返回</span>
          </Link>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
      </section>

      <form className="content-band requirement-form" onSubmit={handleSave}>
        <div className="form-grid two-columns">
          <label className="wide-field">
            <span>需求标题</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="2-100 字"
              disabled={!canEditBaseFields}
            />
            {fieldMessage(fieldErrors, "title") ? (
              <small>{fieldMessage(fieldErrors, "title")}</small>
            ) : null}
          </label>
          <label>
            <span>需求来源</span>
            <select
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
              disabled={!canEditBaseFields}
            >
              <option value="">请选择</option>
              {REQUIREMENT_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {REQUIREMENT_SOURCE_LABELS[source]}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "source") ? (
              <small>{fieldMessage(fieldErrors, "source")}</small>
            ) : null}
          </label>
          <label>
            <span>需求类型</span>
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              disabled={!canEditBaseFields}
            >
              <option value="">请选择</option>
              {REQUIREMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REQUIREMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "type") ? (
              <small>{fieldMessage(fieldErrors, "type")}</small>
            ) : null}
          </label>
          <label>
            <span>优先级</span>
            <select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              disabled={!canEditBaseFields}
            >
              <option value="">请选择</option>
              {REQUIREMENT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {REQUIREMENT_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "priority") ? (
              <small>{fieldMessage(fieldErrors, "priority")}</small>
            ) : null}
          </label>
          {mode === "edit" ? (
            <label>
              <span>需求状态</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                disabled={!canEditStatus}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {REQUIREMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {canEditStatus ? <small>可选择任意需求状态</small> : null}
            </label>
          ) : null}
          <label>
            <span>提出部门</span>
            <select
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              disabled={!canEditBaseFields}
            >
              <option value="">请选择</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "departmentId") ? (
              <small>{fieldMessage(fieldErrors, "departmentId")}</small>
            ) : null}
          </label>
          <label>
            <span>需求跟进人</span>
            <select
              value={form.ownerId}
              onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
              disabled={!canEditFollower}
            >
              <option value="">请选择</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "ownerId") ? (
              <small>{fieldMessage(fieldErrors, "ownerId")}</small>
            ) : null}
          </label>
          <label>
            <span>期望上线时间</span>
            <input
              type="date"
              value={form.expectedReleaseDate}
              onChange={(event) => setForm({ ...form, expectedReleaseDate: event.target.value })}
              disabled={!canEditBaseFields}
            />
            {fieldMessage(fieldErrors, "expectedReleaseDate") ? (
              <small>{fieldMessage(fieldErrors, "expectedReleaseDate")}</small>
            ) : null}
          </label>
          <label className="wide-field">
            <span>相关部门</span>
            <select
              multiple
              value={form.relatedDepartments}
              onChange={(event) => handleRelatedDepartmentsChange(event.target.selectedOptions)}
              disabled={!canEditBaseFields}
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {fieldMessage(fieldErrors, "relatedDepartments") ? (
              <small>{fieldMessage(fieldErrors, "relatedDepartments")}</small>
            ) : null}
          </label>
          <div className="wide-field form-subsection">
            <div className="section-heading compact-heading">
              <h3>审批人</h3>
              <span>仅可选择对应职能负责人</span>
            </div>
            <div className="form-grid two-columns">
              {reviewApproverFields.map((field) => {
                const department = departments.find((item) => item.id === field.departmentId);
                const selectedApproverId = form.reviewApproverAssignments[field.nodeType] ?? "";

                return (
                  <label key={field.nodeType}>
                    <span>{field.label}</span>
                    <select
                      value={selectedApproverId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          reviewApproverAssignments: {
                            ...form.reviewApproverAssignments,
                            [field.nodeType]: event.target.value
                          }
                        })
                      }
                      disabled={!canEditPeopleFields}
                    >
                      <option value="">按默认负责人</option>
                      {(department?.leaders ?? []).map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.displayName}（{leader.username} · {leader.title}）
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="wide-field form-subsection">
            <div className="section-heading compact-heading">
              <h3>项目相关人</h3>
              <span>可选，用于后续项目和任务流转</span>
            </div>
            <div className="form-grid two-columns">
              {projectMemberRoles.map((role) => (
                <label key={role}>
                  <span>{REQUIREMENT_PROJECT_MEMBER_ROLE_LABELS[role]}</span>
                  <select
                    multiple
                    value={form.projectMembers[role]}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        projectMembers: {
                          ...form.projectMembers,
                          [role]: Array.from(event.target.selectedOptions).map((option) => option.value)
                        }
                      })
                    }
                    disabled={!canEditPeopleFields}
                  >
                    {ownerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <label className="wide-field">
            <span>需求描述</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={4}
              disabled={!canEditContentFields}
            />
            {fieldMessage(fieldErrors, "description") ? (
              <small>{fieldMessage(fieldErrors, "description")}</small>
            ) : null}
          </label>
          <label className="wide-field">
            <span>业务背景</span>
            <textarea
              value={form.background}
              onChange={(event) => setForm({ ...form, background: event.target.value })}
              rows={4}
              disabled={!canEditContentFields}
            />
            {fieldMessage(fieldErrors, "background") ? (
              <small>{fieldMessage(fieldErrors, "background")}</small>
            ) : null}
          </label>
          <label className="wide-field">
            <span>需求目标</span>
            <textarea
              value={form.goal}
              onChange={(event) => setForm({ ...form, goal: event.target.value })}
              rows={4}
              disabled={!canEditContentFields}
            />
            {fieldMessage(fieldErrors, "goal") ? (
              <small>{fieldMessage(fieldErrors, "goal")}</small>
            ) : null}
          </label>
          <label className="wide-field">
            <span>影响范围</span>
            <textarea
              value={form.impactScope}
              onChange={(event) => setForm({ ...form, impactScope: event.target.value })}
              rows={3}
              disabled={!canEditContentFields}
            />
            {fieldMessage(fieldErrors, "impactScope") ? (
              <small>{fieldMessage(fieldErrors, "impactScope")}</small>
            ) : null}
          </label>
          <label className="wide-field">
            <span>成功指标</span>
            <textarea
              value={form.successMetric}
              onChange={(event) => setForm({ ...form, successMetric: event.target.value })}
              rows={3}
              disabled={!canEditContentFields}
            />
          </label>
          <label className="wide-field">
            <span>附件</span>
            <textarea
              value={form.attachmentsText}
              onChange={(event) => setForm({ ...form, attachmentsText: event.target.value })}
              rows={3}
              placeholder="每行一个附件：文件名|URL"
              disabled={!canEditContentFields}
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="ghost-button" type="submit" disabled={Boolean(saving) || !canEdit}>
            <Save size={16} aria-hidden="true" />
            <span>
              {saving === "draft" ? "保存中" : postApprovalMode ? "保存变更" : "保存草稿"}
            </span>
          </button>
          {canSubmit ? (
            <button
              className="primary-button inline-action"
              type="button"
              disabled={Boolean(saving)}
              onClick={() => void handleSaveAndSubmit()}
            >
              <Send size={16} aria-hidden="true" />
              <span>{saving === "submit" ? "提交中" : postApprovalMode ? "保存并发起二次评审" : "保存并提交评审"}</span>
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
