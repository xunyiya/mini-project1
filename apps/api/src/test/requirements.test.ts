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

const fullRequirementPayload = {
  title: "移动端审批提醒",
  description: "在移动端首页突出显示待处理评审提醒。",
  background: "项目负责人经常在外出时错过评审提醒，导致评审排队。",
  goal: "让待评审需求可以及时被发现并处理。",
  source: "PRODUCT",
  type: "FEATURE",
  priority: "P1",
  departmentId: "dept_product",
  ownerId: "user_pm",
  expectedReleaseDate: "2026-06-30",
  relatedDepartments: ["dept_platform", "dept_project"],
  impactScope: "影响项目经理和产品经理的移动端工作台。",
  successMetric: "评审平均响应时间降低 30%。",
  attachments: [{ name: "交互草图", url: "https://example.com/demo/mobile-review" }],
  reviewApproverAssignments: {
    PRODUCT: "user_product_assistant",
    TECH: "user_tech_lead",
    TEST: "user_qa",
    OPERATION: "user_ops_service"
  },
  projectMembers: [
    { role: "FRONTEND", userId: "user_developer" },
    { role: "BACKEND", userId: "user_backend_developer" },
    { role: "TEST", userId: "user_qa" }
  ]
};

describe("requirements api", () => {
  beforeEach(() => {
    resetStore();
  });

  it("creates a draft requirement", async () => {
    const token = await login("dept_product", "10001");

    const response = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "客服反馈标签优化",
        description: "优化客服反馈录入时的标签选择体验。"
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      title: "客服反馈标签优化",
      status: "DRAFT",
      submitterId: "user_pm"
    });
    expect(response.body.data.code).toMatch(/^REQ-\d{8}-\d{4}$/);
    expect(getStore().requirementStatusHistories[0]).toMatchObject({
      entityId: response.body.data.id,
      toStatus: "DRAFT"
    });
  });

  it("hides draft requirements from other users", async () => {
    const productToken = await login("dept_product", "10001");
    const developerToken = await login("dept_platform", "10003");

    const createResponse = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${productToken}`)
      .send({
        title: "仅创建人可见草稿",
        description: "保存草稿后，其他用户不应看到。"
      })
      .expect(201);

    await request(app)
      .get(`/api/v1/requirements/${createResponse.body.data.id}`)
      .set("Authorization", `Bearer ${developerToken}`)
      .expect(403);

    const listResponse = await request(app)
      .get("/api/v1/requirements?search=仅创建人可见草稿")
      .set("Authorization", `Bearer ${developerToken}`)
      .expect(200);

    expect(listResponse.body.data.items).toHaveLength(0);
  });

  it("keeps drafts out of the default list and shows own drafts when requested", async () => {
    const productToken = await login("dept_product", "10001");

    const createResponse = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${productToken}`)
      .send({
        title: "我的草稿入口",
        description: "这条草稿只应该出现在草稿视图。"
      })
      .expect(201);

    const defaultListResponse = await request(app)
      .get("/api/v1/requirements?search=我的草稿入口")
      .set("Authorization", `Bearer ${productToken}`)
      .expect(200);

    expect(defaultListResponse.body.data.items).toHaveLength(0);

    const draftListResponse = await request(app)
      .get("/api/v1/requirements?status=DRAFT&search=我的草稿入口")
      .set("Authorization", `Bearer ${productToken}`)
      .expect(200);

    expect(draftListResponse.body.data.items).toHaveLength(1);
    expect(draftListResponse.body.data.items[0]).toMatchObject({
      id: createResponse.body.data.id,
      status: "DRAFT"
    });
  });

  it("rejects submit review when required fields are missing", async () => {
    const token = await login("dept_product", "10001");

    const createResponse = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "缺少评审字段的草稿",
        description: "这个草稿故意不填写提交评审所需字段。"
      })
      .expect(201);

    const response = await request(app)
      .post(`/api/v1/requirements/${createResponse.body.data.id}/submit-review`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.data.fieldErrors).toMatchObject({
      background: ["请填写业务背景"],
      goal: ["请填写需求目标"],
      relatedDepartments: ["请至少选择 1 个相关部门"]
    });
  });

  it("submits a draft requirement and creates review flow", async () => {
    const token = await login("dept_product", "10001");

    const createResponse = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .send(fullRequirementPayload)
      .expect(201);

    const response = await request(app)
      .post(`/api/v1/requirements/${createResponse.body.data.id}/submit-review`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.status).toBe("IN_REVIEW");
    expect(response.body.data.submittedAt).toBeTruthy();
    expect(getStore().reviewFlows.find((flow) => flow.requirementId === createResponse.body.data.id)).toMatchObject({
      status: "IN_PROGRESS"
    });

    const historyResponse = await request(app)
      .get(`/api/v1/requirements/${createResponse.body.data.id}/history`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(historyResponse.body.data.map((item: { toStatus: string }) => item.toStatus)).toEqual([
      "DRAFT",
      "PENDING_REVIEW",
      "IN_REVIEW"
    ]);

    const reviewsResponse = await request(app)
      .get(`/api/v1/requirements/${createResponse.body.data.id}/reviews`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(reviewsResponse.body.data.nodes).toHaveLength(4);
    expect(reviewsResponse.body.data.nodes[0]).toMatchObject({
      nodeName: "产品评审",
      status: "IN_PROGRESS",
      approverId: "user_product_assistant"
    });
    expect(reviewsResponse.body.data.nodes.map((node: { approverId: string }) => node.approverId)).toEqual([
      "user_product_assistant",
      "user_tech_lead",
      "user_qa",
      "user_ops_service"
    ]);
  });

  it("rejects review approvers who are not leaders of the matching function", async () => {
    const token = await login("dept_product", "10001");

    const response = await request(app)
      .post("/api/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...fullRequirementPayload,
        title: "错误审批人校验",
        reviewApproverAssignments: {
          ...fullRequirementPayload.reviewApproverAssignments,
          TECH: "user_developer"
        }
      })
      .expect(400);

    expect(response.body.message).toBe("技术审批人必须是平台研发部负责人");
  });

  it("prevents non-authorized users from editing others' requirements", async () => {
    const token = await login("dept_platform", "10003");

    const response = await request(app)
      .patch("/api/v1/requirements/req_seed_0002")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "开发同学不能改运营草稿" })
      .expect(403);

    expect(response.body.message).toBe("当前状态或权限不允许编辑该需求");
  });

  it("prevents direct core-field edits after pending review", async () => {
    const token = await login("dept_product", "10001");

    const response = await request(app)
      .patch("/api/v1/requirements/req_seed_0001")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "待评审后不能直接改标题" })
      .expect(403);

    expect(response.body.message).toBe("当前状态或权限不允许编辑该需求");
  });

  it("lets an approved requirement follower change the follower but not core fields", async () => {
    const token = await login("dept_product", "10001");

    const followerResponse = await request(app)
      .patch("/api/v1/requirements/req_seed_0004")
      .set("Authorization", `Bearer ${token}`)
      .send({ ownerId: "user_project_manager" })
      .expect(200);

    expect(followerResponse.body.data.ownerId).toBe("user_project_manager");
    expect(getStore().requirements.find((item) => item.id === "req_seed_0004")?.ownerId).toBe(
      "user_project_manager"
    );

    const coreResponse = await request(app)
      .patch("/api/v1/requirements/req_seed_0004")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "已通过需求不能直接改标题" })
      .expect(403);

    expect(coreResponse.body.message).toBe("当前状态或权限不允许编辑该需求");
  });

  it("lets related users add multiple project members to an approved requirement", async () => {
    const token = await login("dept_product", "10001");

    const response = await request(app)
      .patch("/api/v1/requirements/req_seed_0004")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectMembers: [
          { role: "FRONTEND", userId: "user_developer" },
          { role: "FRONTEND", userId: "user_tech_lead" },
          { role: "BACKEND", userId: "user_backend_developer" }
        ]
      })
      .expect(200);

    expect(response.body.data.projectMembers).toEqual(
      expect.arrayContaining([
        { role: "FRONTEND", userId: "user_developer" },
        { role: "FRONTEND", userId: "user_tech_lead" },
        { role: "BACKEND", userId: "user_backend_developer" }
      ])
    );
  });

  it("marks approved content changes as pending secondary review", async () => {
    const token = await login("dept_product", "10002");

    const response = await request(app)
      .patch("/api/v1/requirements/req_seed_0006")
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "活动报名页性能优化范围扩大到图片、接口和埋点加载策略。",
        impactScope: "影响活动页报名转化和运营投放效果。"
      })
      .expect(200);

    expect(response.body.data.status).toBe("PENDING_REVIEW");
    expect(response.body.data.pendingChangeReview).toMatchObject({
      returnStatus: "APPROVED",
      changedFields: ["description", "impactScope"]
    });
    expect(response.body.data.pendingChangeReview.nodeTypes).toEqual(
      expect.arrayContaining(["TECH", "DESIGN", "OPERATION"])
    );
  });

  it("starts secondary review with only related approval nodes", async () => {
    const token = await login("dept_product", "10002");

    await request(app)
      .patch("/api/v1/requirements/req_seed_0006")
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "活动报名页性能优化范围扩大到图片、接口和埋点加载策略。"
      })
      .expect(200);

    const response = await request(app)
      .post("/api/v1/requirements/req_seed_0006/submit-review")
      .set("Authorization", `Bearer ${token}`)
      .send({ reviewKind: "CHANGE" })
      .expect(200);

    expect(response.body.data.status).toBe("IN_REVIEW");

    const flow = getStore().reviewFlows.find((item) => item.requirementId === "req_seed_0006");
    expect(flow).toMatchObject({
      reviewKind: "CHANGE",
      returnStatus: "APPROVED"
    });
    const nodes = getStore().reviewNodes.filter((node) => node.flowId === flow?.id);
    expect(nodes.map((node) => node.nodeType)).toEqual(["TECH", "DESIGN", "OPERATION"]);
  });
});
