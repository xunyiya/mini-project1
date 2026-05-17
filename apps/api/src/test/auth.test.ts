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

describe("auth and rbac api", () => {
  beforeEach(() => {
    resetStore();
  });

  it("logs in and returns auth/me payload with menus and actions", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ departmentId: "dept_platform", login: "10001", password: "Demo@123456" })
      .expect(200);

    expect(response.body).toMatchObject({
      code: "OK",
      message: "登录成功",
      data: {
        tokenType: "Bearer",
        me: {
          user: {
            username: "10001"
          },
          organization: {
            id: "demo-org"
          }
        }
      }
    });
    expect(response.body.data.me.visibleMenus.length).toBeGreaterThan(0);
    expect(response.body.data.me.visibleMenus.map((item: { key: string }) => item.key)).toContain(
      "people"
    );
    expect(response.body.traceId).toBeTruthy();
    expect(getStore().auditLogs[0]?.action).toBe("auth.login");
  });

  it("returns public login options grouped by department leader", async () => {
    const response = await request(app).get("/api/v1/auth/login-options").expect(200);

    const platform = response.body.data.departments.find(
      (department: { id: string }) => department.id === "dept_platform"
    );

    expect(platform.leaders.map((leader: { username: string }) => leader.username)).toContain("10002");
    expect(platform.users).toBeUndefined();
  });

  it("rejects protected endpoints without bearer token", async () => {
    const response = await request(app).get("/api/v1/auth/me").expect(401);

    expect(response.body).toMatchObject({
      code: "UNAUTHORIZED",
      data: null
    });
  });

  it("returns current user information using bearer token", async () => {
    const token = await login("dept_product", "10001");
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.user.username).toBe("10001");
    expect(response.body.data.visibleMenus.map((item: { key: string }) => item.key)).toContain(
      "requirements"
    );
  });

  it("blocks users without api permission on user list", async () => {
    const token = await login("dept_platform", "10003");
    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("paginates users for users with api permission", async () => {
    const token = await login("dept_platform", "10001");
    const response = await request(app)
      .get("/api/v1/users?page=1&pageSize=5")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(5);
    expect(response.body.data.total).toBe(12);
    expect(response.body.data.items[0].passwordHash).toBeUndefined();
  });

  it("lets a department leader create and delete users only in their department", async () => {
    const token = await login("dept_product", "10001");

    const createResponse = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        departmentId: "dept_product",
        displayName: "新产品",
        email: "product.new.demo@example.com",
        title: "产品专员",
        password: "Demo@123456"
      })
      .expect(201);

    expect(createResponse.body.data.departmentId).toBe("dept_product");
    expect(createResponse.body.data.username).toBe("10003");
    expect(getStore().auditLogs[0]?.action).toBe("user.create");

    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        departmentId: "dept_quality",
        displayName: "新测试",
        email: "qa.new.demo@example.com",
        title: "测试专员",
        password: "Demo@123456"
      })
      .expect(403);

    await request(app)
      .delete(`/api/v1/users/${createResponse.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(getStore().users.find((user) => user.id === createResponse.body.data.id)?.status).toBe(
      "disabled"
    );
  });

  it("lets admin add another department leader", async () => {
    const adminToken = await login("dept_platform", "10001");

    const response = await request(app)
      .patch("/api/v1/departments/dept_product/leader")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: "user_product_assistant" })
      .expect(200);

    expect(response.body.data.leaders.map((leader: { username: string }) => leader.username)).toEqual([
      "10001",
      "10002"
    ]);
    expect(getStore().departments.find((department) => department.id === "dept_product")?.leaderUserIds).toEqual([
      "user_pm",
      "user_product_assistant"
    ]);

    const newLeaderToken = await login("dept_product", "10002");
    const meResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${newLeaderToken}`)
      .expect(200);

    expect(meResponse.body.data.managedDepartmentIds).toContain("dept_product");

    const removeResponse = await request(app)
      .delete("/api/v1/departments/dept_product/leader/user_product_assistant")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(removeResponse.body.data.leaders.map((leader: { username: string }) => leader.username)).toEqual([
      "10001"
    ]);
    expect(getStore().departments.find((department) => department.id === "dept_product")?.leaderUserIds).toEqual([
      "user_pm"
    ]);

    await request(app)
      .delete("/api/v1/departments/dept_product/leader/user_pm")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });
});
