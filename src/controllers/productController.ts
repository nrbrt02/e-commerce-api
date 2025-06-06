import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Op } from 'sequelize';
import models from '../models';

const { Product, Category, Supplier } = models;

/**
 * Get all products
 * @route GET /api/products
 * @access Public
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {
    where: {},
    include: [],
  };
  
  // Filter by published status
  if (req.query.published) {
    queryBuilder.where.isPublished = req.query.published === 'true';
  }
  
  // Filter by featured status
  if (req.query.featured) {
    queryBuilder.where.isFeatured = req.query.featured === 'true';
  }
  
  // Filter by digital status
  if (req.query.digital) {
    queryBuilder.where.isDigital = req.query.digital === 'true';
  }
  
  // Filter by supplier
  if (req.query.supplier) {
    queryBuilder.where.supplierId = req.query.supplier;
  }
  
  // Filter by category
  if (req.query.category) {
    queryBuilder.include.push({
      model: Category,
      as: 'categories',
      where: { id: req.query.category },
      through: { attributes: [] },
    });
  }
  
  // Filter by search term
  if (req.query.search || req.query.query) {
    const searchTerm = `%${req.query.search || req.query.query}%`;
    queryBuilder.where[Op.or] = [
      { name: { [Op.iLike]: searchTerm } },
      { description: { [Op.iLike]: searchTerm } },
      { shortDescription: { [Op.iLike]: searchTerm } },
      { sku: { [Op.iLike]: searchTerm } },
    ];
  }
  
  // Filter by price range
  if (req.query.minPrice) {
    queryBuilder.where.price = {
      ...queryBuilder.where.price,
      [Op.gte]: parseFloat(req.query.minPrice as string),
    };
  }
  
  if (req.query.maxPrice) {
    queryBuilder.where.price = {
      ...queryBuilder.where.price,
      [Op.lte]: parseFloat(req.query.maxPrice as string),
    };
  }
  
  // If user is not admin and not filtering by supplier, only show published products
  if (!req.user || req.user.role !== 'admin') {
    if (!req.query.published) {
      queryBuilder.where.isPublished = true;
    }
  }
  
  // Add supplier info
  queryBuilder.include.push({
    model: Supplier,
    as: 'supplier',
    attributes: ['id', 'name', 'email', 'contactPerson'],
  });
  
  // Add category info if not already added
  if (!queryBuilder.include.some((inc: any) => inc.model === Category)) {
    queryBuilder.include.push({
      model: Category,
      as: 'categories',
      through: { attributes: [] },
    });
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
      products,
    },
  });
});

/**
 * Get a single product
 * @route GET /api/products/:id
 * @access Public
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByPk(req.params.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: Supplier,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'contactPerson'],
      },
    ],
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Check if product is published or user is admin/supplier
  if (!product.isPublished) {
    if (!req.user) {
      throw new AppError('Product not found', 404);
    }

    const isAdmin = req.user.role === 'admin';
    const isSupplier = req.user.role === 'supplier' && product.supplierId === req.user.id;

    if (!isAdmin && !isSupplier) {
      throw new AppError('Product not found', 404);
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      product,
    },
  });
});

export const debugAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log('=== DEBUG AUTH INFO ===');
  console.log('Auth Header:', req.headers.authorization ? 'Present' : 'Missing');
  console.log('User Object:', req.user ? 'Present' : 'Missing');
  
  if (req.user) {
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
  }
  
  console.log('Request Body supplierId:', req.body.supplierId);
  console.log('=======================');
  
  next();
};

/**
 * Create a new product
 * @route POST /api/products
 * @access Private (Admin, Supplier)
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    shortDescription,
    sku,
    barcode,
    price,
    compareAtPrice,
    costPrice,
    isPublished,
    isFeatured,
    isDigital,
    quantity,
    lowStockThreshold,
    weight,
    dimensions,
    metadata,
    categoryIds,
    tags,
    images,
  } = req.body;

  // If user is not admin, set supplier to current user
  let supplierId = req.body.supplierId;
  
  if (!supplierId) {
    supplierId = req.user!.id;
  } else if (supplierId !== req.user!.id) {
    // If user is trying to set a different supplier, check if admin
    const isAdmin = req.user!.role === 'admin';
    if (!isAdmin) {
      throw new AppError('You can only create products for yourself', 403);
    }
    
    // Verify supplier exists
    const supplierExists = await Supplier.findByPk(supplierId);
    if (!supplierExists) {
      throw new AppError('Supplier not found', 404);
    }
  }

  // Create product
  const product = await Product.create({
    name,
    description,
    shortDescription,
    sku,
    barcode,
    price,
    compareAtPrice,
    costPrice,
    isPublished: isPublished !== undefined ? isPublished : false,
    isFeatured: isFeatured !== undefined ? isFeatured : false,
    isDigital: isDigital !== undefined ? isDigital : false,
    quantity: quantity || 0,
    lowStockThreshold,
    weight,
    dimensions,
    metadata,
    tags,
    imageUrls: images, // Changed from 'images' to 'imageUrls'
    supplierId,
  });

  // Associate with categories if provided
  if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
    const categories = await Category.findAll({ where: { id: categoryIds } });
    await product.setCategories(categories);
  }

  // Get product with associations
  const newProduct = await Product.findByPk(product.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: Supplier,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'contactPerson'],
      },
    ],
  });

  res.status(201).json({
    status: 'success',
    data: {
      product: newProduct,
    },
  });
});

/**
 * Update a product
 * @route PUT /api/products/:id
 * @access Private (Admin, Supplier)
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  // Find product
  const product = await Product.findByPk(req.params.id);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Check if user has permission to update
  const isAdmin = req.user!.role === 'admin';
  const isSuperadmin = req.user!.role === 'superadmin';
  const isSupplier = req.user!.role === 'supplier' && product.supplierId === req.user!.id;
  
  if (!isAdmin && !isSuperadmin && !isSupplier) {
    throw new AppError('You do not have permission to update this product', 403);
  }
  
  // Update product fields
  const fieldsToUpdate = [
    'name', 'description', 'shortDescription', 'sku', 'barcode',
    'price', 'compareAtPrice', 'costPrice', 'isPublished', 'isFeatured',
    'isDigital', 'quantity', 'lowStockThreshold', 'weight', 'dimensions',
    'metadata', 'tags'
  ];
  
  for (const field of fieldsToUpdate) {
    if (req.body[field] !== undefined) {
      (product as any)[field] = req.body[field];
    }
  }
  
  // Handle the renamed 'images' field
  if (req.body.images !== undefined) {
    product.imageUrls = req.body.images;
  }
  
  // Only admin can update supplier
  if (req.body.supplierId !== undefined && isAdmin) {
    // Verify supplier exists
    const supplierExists = await Supplier.findByPk(req.body.supplierId);
    if (!supplierExists) {
      throw new AppError('Supplier not found', 404);
    }
    product.supplierId = req.body.supplierId;
  }
  
  await product.save();
  
  // Update categories if provided
  if (req.body.categoryIds && Array.isArray(req.body.categoryIds)) {
    const categories = await Category.findAll({ where: { id: req.body.categoryIds } });
    await product.setCategories(categories);
  }
  
  // Get updated product with associations
  const updatedProduct = await Product.findByPk(product.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: Supplier,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'contactPerson'],
      },
    ],
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      product: updatedProduct,
    },
  });
});

/**
 * Delete a product
 * @route DELETE /api/products/:id
 * @access Private (Admin, Supplier)
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  // Find product
  const product = await Product.findByPk(req.params.id);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Check if user has permission to delete
  const isAdmin = req.user!.role === 'admin';
  const isSupplier = req.user!.role === 'supplier' && product.supplierId === req.user!.id;
  
  if (!isAdmin && !isSupplier) {
    throw new AppError('You do not have permission to delete this product', 403);
  }
  
  await product.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

/**
 * Get products by supplier
 * @route GET /api/products/supplier/:supplierId
 * @access Public
 */
export const getProductsBySupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.supplierId);
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Build query
  const queryBuilder: any = {
    where: {
      supplierId,
      isPublished: true,
    },
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
    ],
  };
  
  // Allow admins and suppliers to see unpublished products
  if (req.user) {
    if (req.user.role === 'admin' || (req.user.role === 'supplier' && req.user.id === supplierId)) {
      delete queryBuilder.where.isPublished;
      
      if (req.query.published) {
        queryBuilder.where.isPublished = req.query.published === 'true';
      }
    }
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
      supplier: {
        id: supplier.id,
        name: supplier.name,
      },
      products,
    },
  });
});

/**
 * Get all products including drafts (admin only)
 * @route GET /api/products/admin/all
 * @access Private (Admin)
 */
export const getAllProductsIncludingDrafts = asyncHandler(async (req: Request, res: Response) => {
  const products = await Product.findAll({
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: Supplier,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'contactPerson'],
      },
    ],
  });

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products,
    },
  });
});

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBySupplier,
  getAllProductsIncludingDrafts
};