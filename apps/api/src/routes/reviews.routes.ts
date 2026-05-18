import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth";
import { paginate, parsePagination } from "../lib/pagination";
import { sendSuccess } from "../lib/response";
import { listMyReviews } from "../services/reviews";

export const reviewsRoutes = Router();

reviewsRoutes.get(
  "/my-pending",
  authenticate,
  requirePermission("api.reviews.read"),
  (req, res, next) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const items = listMyReviews(
        {
          status: String(req.query.status ?? "pending"),
          priority: String(req.query.priority ?? ""),
          type: String(req.query.type ?? "")
        },
        req.currentUser!
      );

      return sendSuccess(res, paginate(items, page, pageSize));
    } catch (error) {
      next(error);
    }
  }
);
