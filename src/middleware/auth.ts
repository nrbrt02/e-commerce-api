import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Secret } from 'jsonwebtoken';
import { AppError } from './errorHandler';
import models from '../models';
import config from '../config/env';

const { User, Customer } = models;

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Interface for JWT payload
interface JwtPayload {
  id: number;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Protect routes - Check if user is authenticated
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // Verify token
    const secretKey: Secret = config.jwt.secret;
    const decoded = jwt.verify(token, secretKey) as JwtPayload;

    // Check if user still exists
    const Model = decoded.role === 'admin' ? User : Customer;
    const currentUser = await Model.findByPk(decoded.id);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Check if user is active
    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    // Attach user to request
    req.user = currentUser;
    // Also attach the role from the token to make it easily accessible
    req.user.role = decoded.role;

    next();
  } catch (error) {
    return next(new AppError('Not authorized to access this route', 401));
  }
};

/**
 * Restrict routes to specific roles
 */
export const restrictTo = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if the user has the appropriate role
    if (req.user.role === 'admin') {
      // For admin users (staff), check if they have any of the required roles through role-based permissions
      // Only if roles array specifies particular admin roles (e.g., 'super-admin', 'manager')
      if (roles.length > 0 && !roles.includes('admin')) {
        // This is a restricted admin route that requires specific admin roles
        const hasRole = await req.user.hasAnyRole(roles);
        
        if (!hasRole) {
          return next(new AppError('You do not have permission to perform this action', 403));
        }
      }
      // If no specific admin roles needed or 'admin' is explicitly allowed, permit access
      return next();
    } else if (req.user.role === 'customer') {
      // For customers, only allow if 'customer' is in the allowed roles
      if (!roles.includes('customer')) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      return next();
    } else {
      // For any other role types that might be added in the future
      if (!roles.includes(req.user.role)) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      return next();
    }
  };
};