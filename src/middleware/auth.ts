import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Secret } from 'jsonwebtoken';
import { AppError } from './errorHandler';
import models from '../models';
import config from '../config/env';

const { User, Customer, Supplier } = models;

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
  role?: string;
  roles?: string[];
  username?: string;
  email?: string;
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

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Get token from headers
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // Verify token
    const secretKey: Secret = config.jwt.secret;
    const decoded = jwt.verify(token, secretKey) as JwtPayload;

    // Determine role from either role or roles array
    let role: string;
    if (decoded.role) {
      role = decoded.role.toLowerCase();
    } else if (decoded.roles && decoded.roles.length > 0) {
      // If roles array exists, use the first role
      role = decoded.roles[0].toLowerCase();
    } else {
      throw new AppError('Invalid token format', 401);
    }

    // Determine which model to use based on role
    let Model;
    switch(role) {
      case 'admin':
      case 'superadmin':
        Model = User;
        break;
      case 'supplier':
        Model = Supplier;
        break;
      default:
        Model = Customer;
    }

    const currentUser = await Model.findByPk(decoded.id);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    // Attach user to request
    req.user = currentUser;
    req.user.role = role; // Store role in lowercase

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
    const Model = decoded.role === 'admin' || decoded.role === 'superadmin' ? User : Customer;
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
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('You are not logged in', 401));
    }

    // Allow superadmin to access everything
    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};