// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
// Use require instead of import for jwt to bypass TypeScript's strict type checking
const jwt = require('jsonwebtoken');
import config from '../config/env';
import User from '../models/User';
import logger from '../config/logger';

/**
 * Interface to extend Express Request with authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * JWT payload interface
 */
interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware to protect routes
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. Please provide a valid token.' });
      return;
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    try {
      // Verify token using the required jwt module
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Find user by id
      const user = await User.findByPk(decoded.id);
      
      if (!user) {
        res.status(401).json({ message: 'User not found or token is invalid.' });
        return;
      }
      
      if (!user.isActive) {
        res.status(403).json({ message: 'User account is disabled.' });
        return;
      }
      
      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      logger.error('JWT verification failed:', error);
      res.status(401).json({ message: 'Invalid token. Please log in again.' });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
};

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (userId: number): string => {
  // Use the required jwt module
  return jwt.sign(
    { id: userId },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
};