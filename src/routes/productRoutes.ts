import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductReviews,
  createReview
} from '../controllers';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Reviews routes (nested)
router.get('/:productId/reviews', getProductReviews);

// Protected routes
router.use(protect);

// Customer can create reviews
router.post('/:productId/reviews', restrictTo('customer'), createReview);

// Admin and supplier can create/update/delete products
router.post('/', restrictTo('admin', 'supplier'), createProduct);
router.put('/:id', restrictTo('admin', 'supplier'), updateProduct);
router.delete('/:id', restrictTo('admin', 'supplier'), deleteProduct);

export default router;