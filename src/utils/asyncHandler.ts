import { Request, Response, NextFunction } from 'express';

/**
 * Wrapper function to handle async route handlers properly
 * This eliminates the need for try/catch blocks in each controller
 * 
 * @param fn The async controller function to wrap
 * @returns A function that handles async errors
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;