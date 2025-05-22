import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductsBySupplier,
  getAllProductsIncludingDrafts
} from '../controllers/productController';
import * as reviewController from '../controllers/reviewController';

import { protect, restrictTo, optionalAuthenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', optionalAuthenticate, getProducts);
router.get('/search', optionalAuthenticate, getProducts);
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
router.put('/:id', restrictTo('admin', 'supplier', 'superadmin'), updateProduct);
router.delete('/:id', restrictTo('admin', 'supplier', 'superadmin'), deleteProduct);

// Admin only routes
router.route('/')
  .get(restrictTo('admin'), getProducts)
  .post(restrictTo('admin'), createProduct);

// New admin-only endpoint to get all products including drafts
router.get('/admin/all', restrictTo('admin'), getAllProductsIncludingDrafts);

// Admin and supplier routes (with access control in the controller)
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(restrictTo('admin'), deleteProduct);

export default router;