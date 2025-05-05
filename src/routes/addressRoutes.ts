import express from 'express';
import * as addressController from '../controllers/addressController';
import { authenticate, restrictTo } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);
// Restrict to customer role
router.use(restrictTo('customer'));

// Address routes
router.get('/', addressController.getCustomerAddresses);
router.post('/', addressController.createAddress);
router.get('/:id', addressController.getAddressById);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.patch('/:id/set-default', addressController.setAddressAsDefault);

export default router;