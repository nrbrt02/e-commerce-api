import express from 'express';
import * as userController from '../controllers/userController';
import { protect } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Superadmin-only routes for managing administrators
router.route('/')
  .get(hasRole(['superadmin']), userController.getAdminUsers)
  .post(hasRole(['superadmin']), userController.createAdminUser);

router.route('/:id')
  .get(hasRole(['superadmin']), userController.getAdminUserById)
  .put(hasRole(['superadmin']), userController.updateAdminUser)
  .delete(hasRole(['superadmin']), userController.deleteAdminUser);

router.route('/:id/password')
  .put(hasRole(['superadmin']), userController.updateAdminPassword);

export default router;