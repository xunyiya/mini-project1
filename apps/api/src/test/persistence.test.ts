import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { getStore, reloadStore, resetStore } from "../data/store";

const app = createApp();

async function login(departmentId: string, employeeNo: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ departmentId, login: employeeNo, password: "Demo@123456" });

  return response.body.data.token as string;
}

describe("database persistence", () => {
  beforeEach(() => {
    resetStore();
  });

  it("persists created requirements through a store reload", async () => {
    const token = await login("dept_product", "10001");

    const createResponse = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "数据库持久化验证",
        description: "创建后重新加载 store，需求仍然存在。"
      })
      .expect(201);
    const requirementId = createResponse.body.data.id as string;

    reloadStore();

    expect(getStore().requirements.some((requirement) => requirement.id === requirementId)).toBe(true);

    const detailResponse = await request(app)
      .get(`/api/v1/requirements/${requirementId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(detailResponse.body.data).toMatchObject({
      id: requirementId,
      title: "数据库持久化验证",
      status: "DRAFT"
    });
  });
});
