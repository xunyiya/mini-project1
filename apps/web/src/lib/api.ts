import type {
  ApiResponse,
  AuthMe,
  CreateUserInput,
  DepartmentWithLeader,
  LoginOptions,
  LoginResult,
  PageData,
  PermissionSummary,
  SafeUser,
  UpdateDepartmentLeaderInput
} from "@collab/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

let accessToken: string | null = null;

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly traceId: string;
  public readonly status: number;

  constructor(message: string, code: string, traceId: string, status: number) {
    super(message);
    this.code = code;
    this.traceId = traceId;
    this.status = status;
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
    throw new ApiClientError(body.message, body.code, body.traceId, response.status);
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
  }
};
