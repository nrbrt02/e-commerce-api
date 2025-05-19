import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductsBySupplier
} from '../controllers/productController';
import * as reviewController from '../controllers/reviewController';

import { protect, restrictTo, optionalAuthenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', optionalAuthenticate, getProducts);
router.get('/:id', optionalAuthenticate, getProductById);

// Get products by supplier
router.get('/supplier/:supplierId', optionalAuthenticate, getProductsBySupplier);

// Reviews routes (nested)
router.get('/:productId/reviews', reviewController.getProductReviews);
router.get('/:productId/reviews/stats', reviewController.getProductReviewStats);

// Protected routes
router.use(protect);

// Customer can create reviews
router.post('/:productId/reviews', restrictTo('customer'), reviewController.createReview);

// Admin and supplier can create/update/delete products
router.post('/', restrictTo('admin', 'supplier'), createProduct);
router.put('/:id', restrictTo('admin', 'supplier'), updateProduct);
router.delete('/:id', restrictTo('admin', 'supplier'), deleteProduct);

export default router;