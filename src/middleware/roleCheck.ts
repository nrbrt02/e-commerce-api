import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import User from '../models/User';
import Role from '../models/Role';
import logger from '../config/logger';

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

      const userRoles = await user.$get('roles') as Role[];
      const roleNames = userRoles.map(role => role.name);

      const hasRequiredRole = roles.some(role => roleNames.includes(role));

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

      const userRoles = await user.$get('roles') as Role[];
      
      // Collect all permissions from all user roles
      const userPermissions = userRoles.reduce((allPermissions: string[], role) => {
        return [...allPermissions, ...role.permissions];
      }, []);

      // Check if user has any of the required permissions
      const hasRequiredPermission = requiredPermissions.some(permission => 
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