import express from 'express';
import { 
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getMyOrders,
  // Draft-related controllers
  saveOrderDraft,
  updateOrderDraft,
  getMyDraftOrders,
  getMyDraftOrderById,
  convertDraftToOrder,
  deleteOrderDraft,
  getSupplierOrders
} from '../controllers';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Customer routes
router.get('/my-orders', restrictTo('customer'), getMyOrders);
router.post('/', restrictTo('customer'), createOrder);
router.patch('/:id/cancel', cancelOrder);
router.put('/:id/cancel', cancelOrder);
// Draft-related routes (customer only)
router.get('/drafts', restrictTo('customer'), getMyDraftOrders);
router.get('/draft/:id', restrictTo('customer'), getMyDraftOrderById);
router.post('/draft', restrictTo('customer'), saveOrderDraft);
router.put('/draft/:id', restrictTo('customer'), updateOrderDraft);
router.post('/draft/:id/convert', restrictTo('customer'), convertDraftToOrder);
router.delete('/draft/:id', restrictTo('customer'), deleteOrderDraft);

router.get('/supplier-orders', restrictTo('supplier'), getSupplierOrders);

// Admin routes
router.get('/', restrictTo('admin'), getOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', restrictTo('admin'), updateOrderStatus);
router.patch('/:id/payment', restrictTo('admin'), updatePaymentStatus);

export default router;