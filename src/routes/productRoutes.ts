import express from 'express';
import * as productController from '../controllers/productController';
import { authenticate } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// Public routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Protected routes
router.use(authenticate);

// Create product - accessible to admin and supplier
router.post(
  '/',
  hasPermission(['product:create']),
  productController.createProduct
);

// Update product - accessible to admin and supplier (of the specific product)
router.put(
  '/:id',
  hasPermission(['product:update']),
  productController.updateProduct
);

// Delete product - accessible to admin and supplier (of the specific product)
router.delete(
  '/:id',
  hasPermission(['product:delete']),
  productController.deleteProduct
);

export default router;