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

const payload = {
  title: "评审流接口联调",
  description: "用于验证 Day 3 评审节点状态流转。",
  background: "需求评审需要记录节点、意见和通知。",
  goal: "覆盖评审通过、驳回、补充和通知链路。",
  source: "PRODUCT",
  type: "FEATURE",
  priority: "P1",
  departmentId: "dept_product",
  ownerId: "user_pm",
  expectedReleaseDate: "2026-06-30",
  relatedDepartments: ["dept_platform", "dept_quality", "dept_business"],
  impactScope: "影响需求评审流程。",
  successMetric: "评审动作可追踪。"
};

async function createReviewFlow() {
  const starterToken = await login("dept_product", "10001");
  const createResponse = await request(app)
    .post("/api/v1/requirements")
    .set("Authorization", `Bearer ${starterToken}`)
    .send(payload)
    .expect(201);

  await request(app)
    .post(`/api/v1/requirements/${createResponse.body.data.id}/submit-review`)
    .set("Authorization", `Bearer ${starterToken}`)
    .expect(200);

  const reviewResponse = await request(app)
    .get(`/api/v1/requirements/${createResponse.body.data.id}/reviews`)
    .set("Authorization", `Bearer ${starterToken}`)
    .expect(200);

  return {
    requirementId: createResponse.body.data.id as string,
    nodes: reviewResponse.body.data.nodes as Array<{ id: string; status: string }>
  };
}

describe("review workflows", () => {
  beforeEach(() => {
    resetStore();
  });

  it("lets current approver approve the current node and notifies the next approver", async () => {
    const { requirementId, nodes } = await createReviewFlow();
    const approverToken = await login("dept_product", "10002");

    const response = await request(app)
      .post(`/api/v1/review-nodes/${nodes[0].id}/approve`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ comment: "产品评审通过" })
      .expect(200);

    expect(response.body.data.nodes[0].status).toBe("APPROVED");
    expect(response.body.data.nodes[1].status).toBe("IN_PROGRESS");
    expect(
      getStore().notifications.some(
        (notice) =>
          notice.userId === "user_tech_lead" &&
          notice.entityId === requirementId &&
          notice.title === "有新的需求评审待处理"
      )
    ).toBe(true);

    const pendingResponse = await request(app)
      .get("/api/v1/reviews/my-pending")
      .set("Authorization", `Bearer ${await login("dept_platform", "10002")}`)
      .expect(200);

    expect(
      pendingResponse.body.data.items.some(
        (item: { requirement: { id: string } }) => item.requirement.id === requirementId
      )
    ).toBe(true);
  });

  it("blocks non-approver from handling a review node", async () => {
    const { nodes } = await createReviewFlow();
    const developerToken = await login("dept_platform", "10003");

    await request(app)
      .post(`/api/v1/review-nodes/${nodes[0].id}/approve`)
      .set("Authorization", `Bearer ${developerToken}`)
      .send({ comment: "越权审批" })
      .expect(403);
  });

  it("rejects a node and moves requirement to rejected", async () => {
    const { requirementId, nodes } = await createReviewFlow();
    const approverToken = await login("dept_product", "10002");

    await request(app)
      .post(`/api/v1/review-nodes/${nodes[0].id}/reject`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ comment: "业务目标不清晰" })
      .expect(200);

    expect(getStore().requirements.find((item) => item.id === requirementId)?.status).toBe("REJECTED");
    expect(getStore().reviewFlows.find((flow) => flow.requirementId === requirementId)?.status).toBe(
      "REJECTED"
    );
  });

  it("approves all required nodes and moves requirement to approved", async () => {
    const { requirementId, nodes } = await createReviewFlow();
    const productToken = await login("dept_product", "10002");
    const techToken = await login("dept_platform", "10002");
    const qaToken = await login("dept_quality", "10001");
    const opsToken = await login("dept_business", "10001");

    await request(app)
      .post(`/api/v1/review-nodes/${nodes[0].id}/approve`)
      .set("Authorization", `Bearer ${productToken}`)
      .send({ comment: "产品通过" })
      .expect(200);
    await request(app)
      .post(`/api/v1/review-nodes/${nodes[1].id}/approve`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({ comment: "技术通过" })
      .expect(200);
    await request(app)
      .post(`/api/v1/review-nodes/${nodes[2].id}/approve`)
      .set("Authorization", `Bearer ${qaToken}`)
      .send({ comment: "测试通过" })
      .expect(200);
    await request(app)
      .post(`/api/v1/review-nodes/${nodes[3].id}/approve`)
      .set("Authorization", `Bearer ${opsToken}`)
      .send({ comment: "运营确认" })
      .expect(200);

    expect(getStore().requirements.find((item) => item.id === requirementId)?.status).toBe("APPROVED");
    expect(getStore().reviewFlows.find((flow) => flow.requirementId === requirementId)?.status).toBe(
      "APPROVED"
    );
  });

  it("requests supplement and moves requirement to needs supplement", async () => {
    const { requirementId, nodes } = await createReviewFlow();
    const approverToken = await login("dept_product", "10002");

    await request(app)
      .post(`/api/v1/review-nodes/${nodes[0].id}/request-supplement`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ comment: "请补充影响范围" })
      .expect(200);

    expect(getStore().requirements.find((item) => item.id === requirementId)?.status).toBe(
      "NEEDS_SUPPLEMENT"
    );
    expect(getStore().reviewFlows.find((flow) => flow.requirementId === requirementId)?.status).toBe(
      "NEEDS_SUPPLEMENT"
    );
  });
});
