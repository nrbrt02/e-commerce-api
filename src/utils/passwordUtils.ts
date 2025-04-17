import bcrypt from 'bcrypt';
import config from '../config/env';

/**
 * Hash a password
 * @param password - Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, config.bcrypt.saltRounds);
};

/**
 * Compare a password with a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns Boolean indicating if password matches hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};