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
 * Generate a JWT token
 */
export const generateToken = (userId: number, role: string = 'customer'): string => {
  const payload = { id: userId, role };
  const secret = config.jwt.secret;
  
  // Explicitly type the options to satisfy TypeScript
  const options: jwt.SignOptions = {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"]
  };
  
  return jwt.sign(payload, secret, options);
};

/**
 * Authenticate middleware - Check if user is authenticated
 * Alias for protect to maintain backward compatibility
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  return protect(req, res, next);
};

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
 * Optional authentication middleware
 * Unlike the standard authenticate middleware, this won't return an error if no token is provided
 * It will still validate the token if one is provided
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token exists, just continue without authentication
    if (!token) {
      return next();
    }

    // Verify token
    const secretKey: Secret = config.jwt.secret;
    const decoded = jwt.verify(token, secretKey) as JwtPayload;

    // Check if user still exists
    const Model = decoded.role === 'admin' ? User : Customer;
    const currentUser = await Model.findByPk(decoded.id);

    if (!currentUser) {
      // If user doesn't exist, just continue without authentication
      return next();
    }

    // Check if user is active
    if (!currentUser.isActive) {
      // If user is not active, just continue without authentication
      return next();
    }

    // Attach user to request
    req.user = currentUser;
    // Also attach the role from the token
    req.user.role = decoded.role;

    next();
  } catch (error) {
    // Even if token verification fails, just continue without authentication
    // This allows the route handler to decide how to handle unauthenticated users
    return next();
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