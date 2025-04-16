import bcrypt from 'bcrypt';
import config from '../config/env';

/**
 * Hash a password
 * 
 * @param password Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

/**
 * Validate a password against a hash
 * 
 * @param password Plain text password
 * @param hashedPassword Hashed password to compare against
 * @returns Boolean indicating if passwords match
 */
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};