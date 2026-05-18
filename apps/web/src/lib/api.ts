import type {
  ApiResponse,
  AuthMe,
  ChangePasswordInput,
  CreateUserInput,
  DepartmentWithLeader,
  LoginOptions,
  LoginResult,
  MyReviewItem,
  PageData,
  PermissionSummary,
  ProjectCreateInput,
  ProjectTaskBoard,
  ProjectUpdateInput,
  ProjectView,
  RequirementCreateInput,
  RequirementReviewSummary,
  RequirementStatusHistory,
  RequirementUpdateInput,
  RequirementView,
  ReviewActionInput,
  ReviewTransferInput,
  SafeUser,
  SubmitReviewInput,
  TaskCreateInput,
  TaskDependenciesInput,
  TaskStatusInput,
  TaskUpdateInput,
  TaskView,
  UpdateDepartmentLeaderInput,
  WorkflowTemplate,
  WorkflowTemplateCreateInput,
  WorkflowTemplateUpdateInput
} from "@collab/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

let accessToken: string | null = null;

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly traceId: string;
  public readonly status: number;
  public readonly data: unknown;

  constructor(message: string, code: string, traceId: string, status: number, data?: unknown) {
    super(message);
    this.code = code;
    this.traceId = traceId;
    this.status = status;
    this.data = data;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.code !== "OK") {
    throw new ApiClientError(body.message, body.code, body.traceId, response.status, body.data);
  }

  return body.data;
}

export const apiClient = {
  loginOptions() {
    return request<LoginOptions>("/auth/login-options");
  },
  login(departmentId: string, login: string, password: string) {
    return request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ departmentId, login, password })
    });
  },
  logout() {
    return request<{ loggedOut: boolean }>("/auth/logout", {
      method: "POST"
    });
  },
  me() {
    return request<AuthMe>("/auth/me");
  },
  changePassword(input: ChangePasswordInput) {
    return request<{ changed: boolean }>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  users(page = 1, pageSize = 20, departmentId?: string) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });

    if (departmentId) {
      params.set("departmentId", departmentId);
    }

    return request<PageData<SafeUser>>(`/users?${params.toString()}`);
  },
  createUser(input: CreateUserInput) {
    return request<SafeUser>("/users", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  deleteUser(userId: string) {
    return request<{ deleted: boolean; userId: string }>(`/users/${userId}`, {
      method: "DELETE"
    });
  },
  departments(page = 1, pageSize = 20) {
    return request<PageData<DepartmentWithLeader>>(`/departments?page=${page}&pageSize=${pageSize}`);
  },
  updateDepartmentLeader(departmentId: string, input: UpdateDepartmentLeaderInput) {
    return request<DepartmentWithLeader>(`/departments/${departmentId}/leader`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  removeDepartmentLeader(departmentId: string, userId: string) {
    return request<DepartmentWithLeader>(`/departments/${departmentId}/leader/${userId}`, {
      method: "DELETE"
    });
  },
  permissionSummary() {
    return request<PermissionSummary>("/permissions/summary");
  },
  requirements(params: Record<string, string | number | undefined> = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return request<PageData<RequirementView>>(`/requirements${query ? `?${query}` : ""}`);
  },
  createRequirement(input: RequirementCreateInput) {
    return request<RequirementView>("/requirements", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  requirement(requirementId: string) {
    return request<RequirementView>(`/requirements/${requirementId}`);
  },
  updateRequirement(requirementId: string, input: RequirementUpdateInput) {
    return request<RequirementView>(`/requirements/${requirementId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  submitRequirementReview(requirementId: string, input: SubmitReviewInput = {}) {
    return request<RequirementView>(`/requirements/${requirementId}/submit-review`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  withdrawRequirement(requirementId: string) {
    return request<RequirementView>(`/requirements/${requirementId}/withdraw`, {
      method: "POST"
    });
  },
  requirementHistory(requirementId: string) {
    return request<RequirementStatusHistory[]>(`/requirements/${requirementId}/history`);
  },
  requirementReviews(requirementId: string) {
    return request<RequirementReviewSummary>(`/requirements/${requirementId}/reviews`);
  },
  projects(params: Record<string, string | number | undefined> = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return request<PageData<ProjectView>>(`/projects${query ? `?${query}` : ""}`);
  },
  createProject(input: ProjectCreateInput) {
    return request<ProjectView>("/projects", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  project(projectId: string) {
    return request<ProjectView>(`/projects/${projectId}`);
  },
  updateProject(projectId: string, input: ProjectUpdateInput) {
    return request<ProjectView>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  startProject(projectId: string) {
    return request<ProjectView>(`/projects/${projectId}/start`, {
      method: "POST"
    });
  },
  completeProject(projectId: string) {
    return request<ProjectView>(`/projects/${projectId}/complete`, {
      method: "POST"
    });
  },
  projectTasks(projectId: string) {
    return request<ProjectTaskBoard>(`/projects/${projectId}/tasks`);
  },
  createTask(projectId: string, input: TaskCreateInput) {
    return request<TaskView>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  myTasks(params: Record<string, string | number | undefined> = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return request<PageData<TaskView>>(`/tasks/my${query ? `?${query}` : ""}`);
  },
  task(taskId: string) {
    return request<TaskView>(`/tasks/${taskId}`);
  },
  updateTask(taskId: string, input: TaskUpdateInput) {
    return request<TaskView>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  updateTaskStatus(taskId: string, input: TaskStatusInput) {
    return request<TaskView>(`/tasks/${taskId}/status`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  setTaskDependencies(taskId: string, input: TaskDependenciesInput) {
    return request<TaskView>(`/tasks/${taskId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  myReviews(params: Record<string, string | number | undefined> = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return request<PageData<MyReviewItem>>(`/reviews/my-pending${query ? `?${query}` : ""}`);
  },
  approveReviewNode(nodeId: string, input: ReviewActionInput) {
    return request<RequirementReviewSummary>(`/review-nodes/${nodeId}/approve`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  rejectReviewNode(nodeId: string, input: ReviewActionInput) {
    return request<RequirementReviewSummary>(`/review-nodes/${nodeId}/reject`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  requestSupplementReviewNode(nodeId: string, input: ReviewActionInput) {
    return request<RequirementReviewSummary>(`/review-nodes/${nodeId}/request-supplement`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  transferReviewNode(nodeId: string, input: ReviewTransferInput) {
    return request<RequirementReviewSummary>(`/review-nodes/${nodeId}/transfer`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  workflowTemplates(appliesTo = "REQUIREMENT") {
    return request<WorkflowTemplate[]>(`/workflow-templates?appliesTo=${appliesTo}`);
  },
  createWorkflowTemplate(input: WorkflowTemplateCreateInput) {
    return request<WorkflowTemplate>("/workflow-templates", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  updateWorkflowTemplate(templateId: string, input: WorkflowTemplateUpdateInput) {
    return request<WorkflowTemplate>(`/workflow-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }
};
