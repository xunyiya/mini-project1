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

describe("bug ticket api", () => {
  beforeEach(() => {
    resetStore();
  });

  it("allows all functions to view bug tickets", async () => {
    const executiveToken = await login("dept_management", "10001");

    const response = await request(app)
      .get("/api/v1/defects")
      .set("Authorization", `Bearer ${executiveToken}`)
      .expect(200);

    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items[0]).toHaveProperty("code");
  });

  it("allows regular functions to create bug tickets", async () => {
    const opsToken = await login("dept_business", "10001");

    const response = await request(app)
      .post("/api/v1/defects")
      .set("Authorization", `Bearer ${opsToken}`)
      .send({
        title: "上线验证页面提示文案错误",
        severity: "S3",
        priority: "P2",
        requirementId: "req_seed_0006",
        projectId: "proj_seed_0002",
        finderId: "user_ops_service",
        handlerId: "user_developer",
        relatedUserIds: ["user_qa"],
        description: "上线前验收时发现确认弹窗仍显示旧文案。"
      })
      .expect(201);

    expect(response.body.data.code).toMatch(/^BUG-\d{4}$/);
    expect(getStore().bugTickets.some((bugTicket) => bugTicket.id === response.body.data.id)).toBe(true);
  });

  it("only lets finder handler or related users update bug tickets", async () => {
    const executiveToken = await login("dept_management", "10001");
    const qaToken = await login("dept_quality", "10001");

    await request(app)
      .patch("/api/v1/defects/bug_seed_0001")
      .set("Authorization", `Bearer ${executiveToken}`)
      .send({ status: "FIXED" })
      .expect(403);

    const response = await request(app)
      .patch("/api/v1/defects/bug_seed_0001")
      .set("Authorization", `Bearer ${qaToken}`)
      .send({ status: "TESTING" })
      .expect(200);

    expect(response.body.data.status).toBe("TESTING");
    expect(getStore().bugTickets.find((bugTicket) => bugTicket.id === "bug_seed_0001")?.status).toBe(
      "TESTING"
    );
  });
});
