import express from "express";
import * as reviewController from "../controllers/reviewController";
import { authenticate } from "../middleware/auth";
import { hasPermission } from "../middleware/roleCheck";

const router = express.Router();

// Apply authentication middleware
router.use(authenticate);

// Admin routes (protected with permission middleware)
router.get("/admin/all", reviewController.getAllReviews);
router.patch("/:id/approve", reviewController.toggleReviewApproval);
router.patch("/:id/verify", reviewController.toggleVerifiedPurchase);

// Customer routes
router.get("/customer/me", reviewController.getCustomerReviews);
router.post("/:id/vote", reviewController.voteReviewHelpful);
router.put("/:id", reviewController.updateReview);
router.delete("/:id", reviewController.deleteReview);

// Public routes must come after specific routes to avoid conflicts
router.get("/:id", reviewController.getReviewById);

export default router;
