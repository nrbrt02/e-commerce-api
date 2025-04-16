// Re-export models and interfaces
export * from '../models/User';
export * from '../models/Role';
export * from '../models/Customer';
export * from '../models/Product';
export * from '../models/Category';
export * from '../models/Order';
export * from '../models/OrderItem';

// Service interfaces
export * from '../services/authService';

// Common types
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface FilterOptions {
  [key: string]: any;
}

export interface SortOptions {
  field: string;
  order: 'ASC' | 'DESC';
}

export interface QueryOptions {
  pagination?: PaginationOptions;
  filters?: FilterOptions;
  sort?: SortOptions;
}

export interface Address {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  results: number;
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
}