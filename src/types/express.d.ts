import { User } from '../models/User';
import { Customer } from '../models/Customer';

declare global {
  namespace Express {
    interface Request {
      user?: User | Customer;
    }
  }
}