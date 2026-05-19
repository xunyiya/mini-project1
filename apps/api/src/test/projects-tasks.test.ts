import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { getStore, resetStore } from "../data/store";

const app = createApp();

async function login(departmentId: string, employeeNo: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ departmentId, login: employeeNo, password: "Demo@123456" });

  return response.body.data.token as string;
}

async function createProject(token: string) {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      requirementId: "req_seed_0004",
      name: "接口测试创建项目",
      ownerId: "user_project_manager",
      participantDepartmentIds: ["dept_product", "dept_project", "dept_platform"],
      plannedStartDate: "2026-06-01",
      plannedEndDate: "2026-06-20",
      plannedReleaseDate: "2026-06-22"
    })
    .expect(201);

  return response.body.data as { id: string };
}

async function createTask(token: string, projectId: string, assigneeId = "user_developer") {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "实现任务状态接口",
      description: "覆盖任务创建、状态流转和看板分组。",
      taskType: "FRONTEND",
      priority: "P1",
      assigneeId,
      departmentId: "dept_platform",
      dueDate: "2026-06-08"
    })
    .expect(201);

  return response.body.data as { id: string; status: string };
}

describe("projects and tasks api", () => {
  beforeEach(() => {
    resetStore();
  });

  it("creates a project from an approved requirement and rejects non-approved requirements", async () => {
    const projectManagerToken = await login("dept_project", "10001");

    const createResponse = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${projectManagerToken}`)
      .send({
        requirementId: "req_seed_0004",
        name: "已通过需求立项",
        ownerId: "user_project_manager",
        participantDepartmentIds: ["dept_project", "dept_platform"]
      })
      .expect(201);

    expect(createResponse.body.data).toMatchObject({
      name: "已通过需求立项",
      status: "PLANNING",
      requirementId: "req_seed_0004"
    });

    await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${projectManagerToken}`)
      .send({
        requirementId: "req_seed_0001",
        ownerId: "user_project_manager"
      })
      .expect(400);
  });

  it("moves requirement to scheduled after project creation", async () => {
    const projectManagerToken = await login("dept_project", "10001");

    await createProject(projectManagerToken);

    expect(getStore().requirements.find((item) => item.id === "req_seed_0004")?.status).toBe(
      "SCHEDULED"
    );
    expect(
      getStore().requirementStatusHistories.some(
        (history) => history.entityId === "req_seed_0004" && history.toStatus === "SCHEDULED"
      )
    ).toBe(true);
  });

  it("creates tasks under a project", async () => {
    const projectManagerToken = await login("dept_project", "10001");
    const project = await createProject(projectManagerToken);

    const task = await createTask(projectManagerToken, project.id);

    expect(task).toMatchObject({
      status: "TODO"
    });
    expect(getStore().tasks.find((item) => item.id === task.id)).toMatchObject({
      projectId: project.id,
      assigneeId: "user_developer"
    });
  });

  it("lets the assignee update their own task status", async () => {
    const projectManagerToken = await login("dept_project", "10001");
    const project = await createProject(projectManagerToken);
    const task = await createTask(projectManagerToken, project.id);
    const developerToken = await login("dept_platform", "10003");

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/status`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ status: "IN_PROGRESS", reason: "开始处理" })
      .expect(200);

    expect(response.body.data.status).toBe("IN_PROGRESS");
  });

  it("requires blocker reason when marking blocked", async () => {
    const projectManagerToken = await login("dept_project", "10001");
    const project = await createProject(projectManagerToken);
    const task = await createTask(projectManagerToken, project.id);
    const developerToken = await login("dept_platform", "10003");

    await request(app)
      .post(`/api/v1/tasks/${task.id}/status`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ status: "BLOCKED" })
      .expect(400);

    const response = await request(app)
      .post(`/api/v1/tasks/${task.id}/status`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ status: "BLOCKED", blockerReason: "等待接口字段确认" })
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: "BLOCKED",
      blockerReason: "等待接口字段确认"
    });
  });

  it("blocks non-project members from modifying tasks", async () => {
    const projectManagerToken = await login("dept_project", "10001");
    const project = await createProject(projectManagerToken);
    const task = await createTask(projectManagerToken, project.id);
    const opsToken = await login("dept_business", "10001");

    await request(app)
      .post(`/api/v1/tasks/${task.id}/status`)
      .set("Authorization", `Bearer ${opsToken}`)
      .send({ status: "IN_PROGRESS", reason: "越权处理" })
      .expect(403);
  });

  it("returns a board grouped by task status", async () => {
    const projectManagerToken = await login("dept_project", "10001");
    const project = await createProject(projectManagerToken);
    const task = await createTask(projectManagerToken, project.id);

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set("Authorization", `Bearer ${projectManagerToken}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.board.TODO[0]).toMatchObject({
      id: task.id,
      status: "TODO"
    });
  });

  it("returns requirement-linked task board todos for current reviewers and approved followers", async () => {
    const productToken = await login("dept_product", "10002");

    const response = await request(app)
      .get("/api/v1/tasks/board")
      .set("Authorization", `Bearer ${productToken}`)
      .expect(200);

    const todoTitles = response.body.data.columns.TODO.map(
      (item: { requirement: { title: string } }) => item.requirement.title
    );

    expect(todoTitles).toEqual(expect.arrayContaining(["项目风险红黄灯规则", "活动报名页性能优化"]));
  });

  it("places project members by whether their requirement stage is waiting, current, delivered, or archived", async () => {
    const developerToken = await login("dept_platform", "10003");
    const store = getStore();
    const waitingRequirement = store.requirements.find((item) => item.id === "req_seed_0004")!;
    const deliveredRequirement = store.requirements.find((item) => item.id === "req_seed_0006")!;
    const archivedRequirement = store.requirements.find((item) => item.id === "req_seed_0008")!;

    waitingRequirement.status = "SCHEDULED";
    waitingRequirement.projectMembers = [{ role: "FRONTEND", userId: "user_developer" }];
    deliveredRequirement.status = "DEVELOPMENT_DONE";
    deliveredRequirement.projectMembers = [{ role: "FRONTEND", userId: "user_developer" }];
    archivedRequirement.status = "ARCHIVED";
    archivedRequirement.projectMembers = [{ role: "FRONTEND", userId: "user_developer" }];

    const response = await request(app)
      .get("/api/v1/tasks/board")
      .set("Authorization", `Bearer ${developerToken}`)
      .expect(200);

    expect(
      response.body.data.columns.IN_PROGRESS.some(
        (item: { requirement: { id: string } }) => item.requirement.id === waitingRequirement.id
      )
    ).toBe(true);
    expect(
      response.body.data.columns.DELIVERED.some(
        (item: { requirement: { id: string } }) => item.requirement.id === deliveredRequirement.id
      )
    ).toBe(true);
    expect(
      response.body.data.columns.ARCHIVED.some(
        (item: { requirement: { id: string } }) => item.requirement.id === archivedRequirement.id
      )
    ).toBe(true);
  });
});
