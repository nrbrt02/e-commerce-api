import express from 'express';
import * as uploadController from '../controllers/uploadController';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload avatar (available to any authenticated user)
router.post('/avatar', uploadController.uploadAvatar);

// Product image uploads (Admin, Supplier)
router.post(
  '/product/:productId',
  hasPermission(['product:update']),
  uploadController.uploadProductImages
);

// Review image uploads (Customer)
router.post('/review/:reviewId', uploadController.uploadReviewImages);

// Delete file (Admin)
router.delete(
  '/file',
  hasPermission(['product:update']),
  uploadController.deleteUploadedFile
);

export default router;