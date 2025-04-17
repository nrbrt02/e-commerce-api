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
    // If user has admin role, allow access
    if (req.user.role === 'admin') {
      return next();
    }

    // If user is admin user (not customer), check roles
    if (req.user.role === 'admin') {
      const hasRole = await req.user.hasAnyRole(roles);
      
      if (!hasRole) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
    } else if (!roles.includes('customer')) {
      // If user is customer and roles don't include 'customer'
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};