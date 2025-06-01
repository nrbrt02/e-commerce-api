import express from 'express';
import * as userController from '../controllers/userController';
import { protect } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

router.use(protect);

router.route('/admin')
  .get(hasRole(['superadmin']), userController.getAdminUsers)
  .post(hasRole(['superadmin']), userController.createAdminUser);

router.route('/admin/:id')
  .get(hasRole(['superadmin']), userController.getAdminUserById)
  .put(hasRole(['superadmin']), userController.updateAdminUser)
  .delete(hasRole(['superadmin']), userController.deleteAdminUser);

router.route('/admin/:id/password')
  .put(hasRole(['superadmin']), userController.updateAdminPassword);
router.route('/:id/status')

  .put(hasRole(['superadmin']), userController.changeUserStatus);
// General user management routes (superadmin only)
router.route('/')
  .get(hasRole(['superadmin']), userController.getUsers)
  .post(hasRole(['superadmin']), userController.createUser);

router.route('/:id')
  .get(hasRole(['superadmin']), userController.getUserById)
  .put(hasRole(['superadmin']), userController.updateUser)
  .delete(hasRole(['superadmin']), userController.deleteUser);

router.route('/:id/password')
  .put(hasRole(['superadmin']), userController.updateUserPassword);

export default router;