import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { sendSuccess } from "../lib/response";
import {
  approveReviewNode,
  rejectReviewNode,
  requestSupplementReviewNode,
  transferReviewNode
} from "../services/reviews";

export const reviewNodesRoutes = Router();

const commentSchema = z.object({
  comment: z.string().trim().optional()
});

const requiredCommentSchema = z.object({
  comment: z.string().trim().min(1, "请填写处理原因")
});

const transferSchema = z.object({
  targetUserId: z.string().trim().min(1, "请选择转派目标评审人"),
  reason: z.string().trim().min(1, "请填写转派原因")
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

reviewNodesRoutes.post("/:nodeId/approve", authenticate, (req, res, next) => {
  try {
    const input = commentSchema.parse(req.body ?? {});
    const result = approveReviewNode(
      routeParam(req.params.nodeId),
      req.currentUser!,
      req.traceId,
      input.comment
    );

    return sendSuccess(res, result, "评审节点已通过");
  } catch (error) {
    next(error);
  }
});

reviewNodesRoutes.post("/:nodeId/reject", authenticate, (req, res, next) => {
  try {
    const input = requiredCommentSchema.parse(req.body ?? {});
    const result = rejectReviewNode(
      routeParam(req.params.nodeId),
      req.currentUser!,
      req.traceId,
      input.comment
    );

    return sendSuccess(res, result, "评审节点已驳回");
  } catch (error) {
    next(error);
  }
});

reviewNodesRoutes.post("/:nodeId/request-supplement", authenticate, (req, res, next) => {
  try {
    const input = requiredCommentSchema.parse(req.body ?? {});
    const result = requestSupplementReviewNode(
      routeParam(req.params.nodeId),
      req.currentUser!,
      req.traceId,
      input.comment
    );

    return sendSuccess(res, result, "已要求补充需求信息");
  } catch (error) {
    next(error);
  }
});

reviewNodesRoutes.post("/:nodeId/transfer", authenticate, (req, res, next) => {
  try {
    const input = transferSchema.parse(req.body ?? {});
    const result = transferReviewNode(
      routeParam(req.params.nodeId),
      req.currentUser!,
      req.traceId,
      input.targetUserId,
      input.reason
    );

    return sendSuccess(res, result, "评审节点已转派");
  } catch (error) {
    next(error);
  }
});
