import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import models from '../models'; // Import models from your models index
import logger from '../config/logger';

// Extract User and Role from your models
const { User, Role } = models;

// Define Role interface to fix typing issues
interface RoleWithPermissions {
  id: number;
  name: string;
  permissions: string[];
}

/**
 * Middleware to check if user has required roles
 * @param roles Array of role names required for access
 */
export const hasRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await User.findByPk(req.user.id, {
        include: [{ model: Role, as: 'roles' }]
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Use getRoles() instead of $get('roles')
      const userRoles = await user.getRoles();
      const roleNames = userRoles.map((role: { name: string }) => role.name);

      const hasRequiredRole = roles.some((role: string) => roleNames.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({ 
          message: 'You do not have permission to perform this action' 
        });
      }

      next();
    } catch (error) {
      logger.error('Role check middleware error:', error);
      next(new AppError('Error checking user permissions', 500));
    }
  };
};

/**
 * Middleware to check if user has required permissions
 * @param requiredPermissions Array of permission strings required for access (e.g., ['product:create', 'product:update'])
 */
export const hasPermission = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await User.findByPk(req.user.id, {
        include: [{ model: Role, as: 'roles' }]
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Use getRoles() instead of $get('roles')
      const userRoles = await user.getRoles() as RoleWithPermissions[];
      
      // Collect all permissions from all user roles
      const userPermissions = userRoles.reduce((allPermissions: string[], role: RoleWithPermissions) => {
        return [...allPermissions, ...role.permissions];
      }, []);

      // Check if user has any of the required permissions
      const hasRequiredPermission = requiredPermissions.some((permission: string) => 
        userPermissions.includes(permission)
      );

      if (!hasRequiredPermission) {
        return res.status(403).json({ 
          message: 'You do not have permission to perform this action' 
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check middleware error:', error);
      next(new AppError('Error checking user permissions', 500));
    }
  };
};