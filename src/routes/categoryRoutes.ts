import express from 'express';
import * as categoryController from '../controllers/categoryController';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// Public routes
router.get('/', categoryController.getCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', categoryController.getCategoryProducts);

// Protected routes (Admin only)
router.use(authenticate);
router.post('/', hasPermission(['category:create']), categoryController.createCategory);
router.put('/:id', hasPermission(['category:update']), categoryController.updateCategory);
router.delete('/:id', hasPermission(['category:delete']), categoryController.deleteCategory);

export default router;