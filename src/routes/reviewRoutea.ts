import express from 'express';
import * as reviewController from '../controllers/reviewController';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// Public routes
router.get('/:id', reviewController.getReviewById);

// Protected routes
router.use(authenticate);

// Customer routes
router.put('/:id', reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);
router.post('/:id/vote', reviewController.voteReviewHelpful);
router.get('/customer/me', reviewController.getCustomerReviews);

// Admin routes
router.use(hasPermission(['review:manage']));

export default router;