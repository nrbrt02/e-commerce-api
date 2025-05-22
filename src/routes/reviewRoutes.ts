import express from "express";
import * as reviewController from "../controllers/reviewController";
import { authenticate, protect, restrictTo } from "../middleware/auth";
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

// Supplier routes - read-only access to their product reviews
router.get('/supplier', restrictTo('supplier'), reviewController.getSupplierProductReviews);

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);
router.get('/product/:productId/stats', reviewController.getProductReviewStats);

// Protected routes
router.use(protect);

// Customer routes
router.post('/product/:productId', restrictTo('customer'), reviewController.createReview);
router.put('/:id', restrictTo('customer'), reviewController.updateReview);
router.delete('/:id', restrictTo('customer'), reviewController.deleteReview);

// Public routes must come after specific routes to avoid conflicts
router.get("/:id", reviewController.getReviewById);

export default router;
