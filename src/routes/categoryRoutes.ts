import express from 'express';
import { 
  getCategories, 
  getCategoryTree,
  getCategoryById, 
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/tree', getCategoryTree);
router.get('/:id', getCategoryById);
router.get('/:id/products', getCategoryProducts);

// Protected routes - Admin only
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;