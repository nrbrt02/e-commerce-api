import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import config from '../config/env';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Sequelize validation errors
 */
const handleSequelizeValidationError = (err: any) => {
  const message = Object.values(err.errors)
    .map((e: any) => e.message)
    .join(', ');
  return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

/**
 * Handle JWT expiration
 */
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

/**
 * Global error handling middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Log the error
  logger.error(`${err.statusCode} - ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    error: err,
    stack: err.stack,
  });

  // Handle specific error types
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'SequelizeValidationError') error = handleSequelizeValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Development vs Production error responses
  if (config.server.nodeEnv === 'development') {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      error: err,
      stack: err.stack,
    });
  } else {
    // Don't leak error details in production
    if (error.isOperational) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message,
      });
    } else {
      // For programming or unknown errors
      logger.error('PROGRAMMING ERROR: ', err);
      return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
      });
    }
  }
};