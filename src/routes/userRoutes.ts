import express from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { hasRole, hasPermission } from '../middleware/roleCheck';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Admin-only routes
router.route('/')
  .get(hasPermission(['user:view']), userController.getUsers)
  .post(hasPermission(['user:create']), userController.createUser);

router.route('/:id')
  .get(hasPermission(['user:view']), userController.getUserById)
  .put(hasPermission(['user:update']), userController.updateUser)
  .delete(hasPermission(['user:delete']), userController.deleteUser);

router.route('/:id/password')
  .put(hasPermission(['user:update']), userController.updateUserPassword);

export default router;