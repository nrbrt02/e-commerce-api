import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

// Define interface for the tree node structure
interface CategoryTreeNode extends Record<string, any> {
  children: CategoryTreeNode[];
}

/**
 * Get all categories
 * @route GET /api/categories
 * @access Public
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {};
  
  // Filter by active
  if (req.query.active) {
    queryBuilder.where = {
      isActive: req.query.active === 'true',
    };
  }
  
  // Filter by parent category
  if (req.query.parent) {
    queryBuilder.where = {
      ...queryBuilder.where,
      parentId: req.query.parent || null,
    };
  }
  
  // Order by
  queryBuilder.order = [['order', 'ASC']];
  
  // Execute query
  const categories = await Category.findAll(queryBuilder);
  
  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories,
    },
  });
});

/**
 * Get category tree (hierarchical structure)
 * @route GET /api/categories/tree
 * @access Public
 */
export const getCategoryTree = asyncHandler(async (req: Request, res: Response) => {
  // Get all categories
  const allCategories = await Category.findAll({
    where: {
      isActive: true,
    },
    order: [['order', 'ASC']],
  });
  
  // Build the tree with explicit return type
  const buildTree = (parentId: number | null = null): CategoryTreeNode[] => {
    return allCategories
      .filter(category => category.parentId === parentId)
      .map(category => ({
        ...category.toJSON(),
        children: buildTree(category.id),
      }));
  };
  
  const categoryTree = buildTree(null);
  
  res.status(200).json({
    status: 'success',
    data: {
      categories: categoryTree,
    },
  });
});

/**
 * Get a single category
 * @route GET /api/categories/:id
 * @access Public
 */
export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findByPk(req.params.id);

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      category,
    },
  });
});

/**
 * Get products by category
 * @route GET /api/categories/:id/products
 * @access Public
 */
export const getCategoryProducts = asyncHandler(async (req: Request, res: Response) => {
  // Check if category exists
  const category = await Category.findByPk(req.params.id);
  
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  
  // Build query
  const queryBuilder: any = {
    include: [
      {
        model: Category,
        as: 'categories',
        where: { id: req.params.id },
        through: { attributes: [] },
      },
    ],
  };
  
  // Filter by published status for non-admin users
  if (!req.user || !(await req.user.hasRole('admin'))) {
    queryBuilder.where = {
      isPublished: true,
    };
  }
  
  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  
  queryBuilder.limit = limit;
  queryBuilder.offset = offset;
  
  // Sorting
  const sortField = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  queryBuilder.order = [[sortField as string, sortOrder]];
  
  // Execute query
  const { count, rows: products } = await Product.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    pagination: {
      totalProducts: count,
      totalPages,
      currentPage: page,
      limit,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    data: {
      category,
      products,
    },
  });
});

/**
 * Create a new category
 * @route POST /api/categories
 * @access Private (Admin)
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    image,
    parentId,
    isActive,
    order,
    metadata,
    slug, // Add slug to destructuring
  } = req.body;
  
  // Validate required fields
  if (!name) {
    throw new AppError('Category name is required', 400);
  }
  
  // Check if parent category exists if provided
  if (parentId) {
    const parentCategory = await Category.findByPk(parentId);
    if (!parentCategory) {
      throw new AppError('Parent category not found', 404);
    }
  }
  
  // Create category
  const category = await Category.create({
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), // Generate slug if not provided
    description,
    image,
    parentId: parentId || null,
    isActive: isActive !== undefined ? isActive : true,
    order: order || 0,
    metadata,
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      category,
    },
  });
});

/**
 * Update a category
 * @route PUT /api/categories/:id
 * @access Private (Admin)
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    slug,
    description,
    image,
    parentId,
    isActive,
    order,
    metadata,
  } = req.body;
  
  // Find category
  const category = await Category.findByPk(req.params.id);
  
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  
  // Check for circular reference in parent category
  if (parentId && parentId !== category.parentId) {
    if (parseInt(req.params.id) === parentId) {
      throw new AppError('Category cannot be its own parent', 400);
    }
    
    // Check if the new parent would create a circular reference
    let currentParent = await Category.findByPk(parentId);
    while (currentParent && currentParent.parentId) {
      if (currentParent.parentId === parseInt(req.params.id)) {
        throw new AppError('Circular reference detected in category hierarchy', 400);
      }
      currentParent = await Category.findByPk(currentParent.parentId);
    }
    
    // Check if parent category exists
    const parentCategory = await Category.findByPk(parentId);
    if (!parentCategory) {
      throw new AppError('Parent category not found', 404);
    }
  }
  
  // Update category fields
  if (name) category.name = name;
  if (slug) category.slug = slug;
  if (description !== undefined) category.description = description;
  if (image !== undefined) category.image = image;
  if (parentId !== undefined) category.parentId = parentId;
  if (isActive !== undefined) category.isActive = isActive;
  if (order !== undefined) category.order = order;
  if (metadata) category.metadata = metadata;
  
  await category.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      category,
    },
  });
});

/**
 * Delete a category
 * @route DELETE /api/categories/:id
 * @access Private (Admin)
 */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  // Find category
  const category = await Category.findByPk(req.params.id);
  
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  
  // Check if category has child categories
  const childCategories = await Category.findAll({
    where: { parentId: category.id },
  });
  
  if (childCategories.length > 0) {
    throw new AppError('Cannot delete a category that has child categories', 400);
  }
  
  // Check if category has associated products
  const products = await category.getProducts();
  
  if (products.length > 0) {
    throw new AppError('Cannot delete a category that has associated products', 400);
  }
  
  await category.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});