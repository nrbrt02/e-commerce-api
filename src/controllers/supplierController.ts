import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import models from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/db';

const { Supplier, Product, Order, OrderItem } = models;

/**
 * Get all suppliers
 * @route GET /api/suppliers
 * @access Private (Admin)
 */
export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {
    where: {},
  };
  
  // Filter by verified status
  if (req.query.verified) {
    queryBuilder.where.isVerified = req.query.verified === 'true';
  }
  
  // Filter by active status
  if (req.query.active) {
    queryBuilder.where.isActive = req.query.active === 'true';
  }
  
  // Filter by name search
  if (req.query.search) {
    const searchTerm = `%${req.query.search}%`;
    queryBuilder.where = {
      ...queryBuilder.where,
      [Op.or]: [
        { name: { [Op.iLike]: searchTerm } },
        { contactPerson: { [Op.iLike]: searchTerm } },
        { email: { [Op.iLike]: searchTerm } },
      ]
    };
  }
  
  // Filter by minimum rating
  if (req.query.minRating) {
    const minRating = parseFloat(req.query.minRating as string);
    queryBuilder.where.rating = {
      ...queryBuilder.where.rating,
      [Op.gte]: minRating,
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
  const { count, rows: suppliers } = await Supplier.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: suppliers.length,
    pagination: {
      totalSuppliers: count,
      totalPages,
      currentPage: page,
      limit,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    data: {
      suppliers,
    },
  });
});

/**
 * Get a single supplier
 * @route GET /api/suppliers/:id
 * @access Private (Admin, Supplier)
 */
export const getSupplierById = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findByPk(req.params.id, {
    attributes: { exclude: ['password'] },
  });

  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }

  // If requester is a supplier, they can only view their own profile
  if (!['admin', 'superadmin'].includes(req.user.role) && req.user.id !== parseInt(req.params.id)) {
    throw new AppError('You are not authorized to view this supplier', 403);
  }

  res.status(200).json({
    status: 'success',
    data: {
      supplier,
    },
  });
});

/**
 * Get supplier products
 * @route GET /api/suppliers/:id/products
 * @access Public (with private access for supplier)
 */
export const getSupplierProducts = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);

  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Build query
  const queryBuilder: any = {
    where: {
      supplierId,
    },
    include: [
      {
        model: models.Category,
        as: 'categories',
        through: { attributes: [] },
      },
    ],
  };
  
  // Check if the request is from the supplier themselves
  const isSupplierRequest = req.user?.role === 'supplier' && req.user.id === supplierId;
  
  // If not a supplier request, only show published products
  if (!isSupplierRequest) {
    queryBuilder.where.isPublished = true;
  }
  
  // If it's a supplier request and they want to filter by published status
  if (isSupplierRequest && req.query.published) {
    queryBuilder.where.isPublished = req.query.published === 'true';
  }
  
  // Filter by category
  if (req.query.category) {
    queryBuilder.include[0].where = {
      id: req.query.category
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
      supplier: {
        id: supplier.id,
        name: supplier.name,
      },
      products,
    },
  });
});

/**
 * Get supplier orders
 * @route GET /api/suppliers/:id/orders
 * @access Private (Admin, Supplier)
 */
export const getSupplierOrders = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);

  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Verify authorization (admin or the supplier itself)
  if (!['admin', 'superadmin'].includes(req.user.role) && req.user.id !== supplierId) {
    throw new AppError('You are not authorized to access these orders', 403);
  }
  
  // Find all products from this supplier
  const products = await Product.findAll({
    where: { supplierId },
    attributes: ['id']
  });
  
  // Fixed: Add explicit type annotation to avoid implicit any
  const productIds = products.map((product: { id: number }) => product.id);
  
  // Build query for orders containing supplier's products
  const queryBuilder: any = {
    include: [
      {
        model: OrderItem,
        as: 'items',
        where: {
          productId: {
            [Op.in]: productIds
          }
        },
        include: [
          {
            model: Product,
            as: 'product',
            where: { supplierId },
            attributes: ['id', 'name', 'sku', 'price']
          }
        ]
      },
      {
        model: models.Customer,
        as: 'customer',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  };
  
  // Filter by status
  if (req.query.status) {
    queryBuilder.where = {
      ...queryBuilder.where,
      status: req.query.status
    };
  }
  
  // Filter by date range
  if (req.query.startDate) {
    queryBuilder.where = {
      ...queryBuilder.where,
      createdAt: {
        ...(queryBuilder.where?.createdAt || {}),
        [Op.gte]: new Date(req.query.startDate as string)
      }
    };
  }
  
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate as string);
    endDate.setHours(23, 59, 59, 999); // End of day
    
    queryBuilder.where = {
      ...queryBuilder.where,
      createdAt: {
        ...(queryBuilder.where?.createdAt || {}),
        [Op.lte]: endDate
      }
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
  const { count, rows: orders } = await Order.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: orders.length,
    pagination: {
      totalOrders: count,
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
      orders,
    },
  });
});

/**
 * Create a new supplier
 * @route POST /api/suppliers
 * @access Private (Admin)
 */
export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    isVerified,
    isActive
  } = req.body;
  
  // Validate required fields
  if (!name || !email || !password || !contactPerson) {
    throw new AppError('Please provide name, email, password, and contact person', 400);
  }
  
  // Check if email already exists
  const existingSupplier = await Supplier.findOne({ where: { email } });
  if (existingSupplier) {
    throw new AppError('Email already in use', 400);
  }
  
  // Create supplier
  const supplier = await Supplier.create({
    name,
    email,
    password, // Will be hashed by model hook
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    isVerified: isVerified !== undefined ? isVerified : false,
    isActive: isActive !== undefined ? isActive : true,
  });
  
  // Remove password from response
  const supplierData = supplier.toJSON();
  
  res.status(201).json({
    status: 'success',
    data: {
      supplier: supplierData,
    },
  });
});

/**
 * Update a supplier
 * @route PUT /api/suppliers/:id
 * @access Private (Admin, Supplier)
 */
export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Verify authorization (admin or the supplier itself)
  if (!['admin', 'superadmin'].includes(req.user.role) && req.user.id !== supplierId) {
    throw new AppError('You are not authorized to update this supplier', 403);
  }
  
  const {
    name,
    email,
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    isVerified,
    isActive
  } = req.body;
  
  // Check if email is being changed and is already in use
  if (email && email !== supplier.email) {
    const existingSupplier = await Supplier.findOne({ where: { email } });
    if (existingSupplier) {
      throw new AppError('Email already in use', 400);
    }
  }
  
  // Update fields
  if (name) supplier.name = name;
  if (email) supplier.email = email;
  if (contactPerson) supplier.contactPerson = contactPerson;
  if (phone !== undefined) supplier.phone = phone;
  if (address !== undefined) supplier.address = address;
  if (website !== undefined) supplier.website = website;
  if (description !== undefined) supplier.description = description;
  if (tin !== undefined) supplier.tin = tin;
  
  // Only admin can update verification and active status
  if (req.user.role === 'admin') {
    if (isVerified !== undefined) supplier.isVerified = isVerified;
    if (isActive !== undefined) supplier.isActive = isActive;
  }
  
  await supplier.save();
  
  // Remove password from response
  const supplierData = supplier.toJSON();
  
  res.status(200).json({
    status: 'success',
    data: {
      supplier: supplierData,
    },
  });
});

/**
 * Update supplier password
 * @route PUT /api/suppliers/:id/password
 * @access Private (Admin, Supplier)
 */
export const updateSupplierPassword = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Verify authorization (admin or the supplier itself)
  if (!['admin', 'superadmin'].includes(req.user.role) && req.user.id !== supplierId) {
    throw new AppError('You are not authorized to update this supplier password', 403);
  }
  
  const { currentPassword, newPassword } = req.body;
  
  // Admin can update password without providing current password
  if (['admin', 'superadmin'].includes(req.user.role)) {
    if (!newPassword) {
      throw new AppError('Please provide new password', 400);
    }
    
    supplier.password = newPassword;
    await supplier.save();
  } else {
    // Supplier must provide current password
    if (!currentPassword || !newPassword) {
      throw new AppError('Please provide current and new password', 400);
    }
    
    // Verify current password
    const isPasswordValid = await supplier.validatePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    supplier.password = newPassword;
    await supplier.save();
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

/**
 * Delete a supplier
 * @route DELETE /api/suppliers/:id
 * @access Private (Admin)
 */
export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Check if supplier has products
  const productCount = await Product.count({ where: { supplierId } });
  if (productCount > 0) {
    throw new AppError(`Cannot delete supplier with associated products. The supplier has ${productCount} products.`, 400);
  }
  
  await supplier.destroy();
  
  res.status(200).json({
    status: 'success',
    message: 'Supplier deleted successfully',
  });
});

/**
 * Get supplier dashboard statistics
 * @route GET /api/suppliers/:id/stats
 * @access Private (Admin, Supplier)
 */
export const getSupplierStats = asyncHandler(async (req: Request, res: Response) => {
  const supplierId = parseInt(req.params.id);
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  // Verify authorization (admin or the supplier itself)
  if (!['admin', 'superadmin'].includes(req.user.role) && req.user.id !== supplierId) {
    throw new AppError('You are not authorized to view these statistics', 403);
  }
  
  // Get total products count
  const totalProducts = await Product.count({ where: { supplierId } });
  
  // Get published products count
  const publishedProducts = await Product.count({ 
    where: { 
      supplierId,
      isPublished: true
    } 
  });
  
  // Get featured products count
  const featuredProducts = await Product.count({ 
    where: { 
      supplierId,
      isFeatured: true
    } 
  });
  
  // Get products out of stock
  const outOfStockProducts = await Product.count({ 
    where: { 
      supplierId,
      isDigital: false,
      quantity: 0
    } 
  });
  
  // Get products running low on stock
  const lowStockProducts = await Product.count({
    where: {
      supplierId,
      isDigital: false,
      quantity: {
        [Op.gt]: 0,
        [Op.lte]: 10 // Using a fixed threshold of 10 for now
      }
    }
  });
  
  // Find all products from this supplier
  const products = await Product.findAll({
    where: { supplierId },
    attributes: ['id']
  });
  
  // Fixed: Add explicit type annotation to avoid implicit any
  const productIds = products.map((product: { id: number }) => product.id);
  
  // Get orders stats for supplier's products
  const recentOrdersCount = await Order.count({
    include: [{
      model: OrderItem,
      as: 'items',
      where: {
        productId: {
          [Op.in]: productIds
        }
      }
    }],
    where: {
      createdAt: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    }
  });
  
  // Get total revenue from all time
  const totalRevenueResult = await OrderItem.sum('total', {
    where: {
      productId: {
        [Op.in]: productIds
      }
    },
    include: [{
      model: Order,
      as: 'order',
      where: {
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }]
  });
  
  const totalRevenue = totalRevenueResult || 0;
  
  // Get total revenue from last 30 days
  const recentRevenueResult = await OrderItem.sum('total', {
    where: {
      productId: {
        [Op.in]: productIds
      }
    },
    include: [{
      model: Order,
      as: 'order',
      where: {
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        },
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      attributes: []
    }]
  });
  
  const recentRevenue = recentRevenueResult || 0;
  
  // Get the average rating for supplier's products
  const avgRatingResult = await Product.findOne({
    where: {
      supplierId,
      metadata: {
        [Op.ne]: null
      }
    },
    attributes: [
      [
        sequelize.fn('AVG', 
          sequelize.cast(
            sequelize.fn('NULLIF', 
              sequelize.fn('JSONB_EXTRACT_PATH_TEXT', 
                sequelize.col('metadata'), 
                'rating', 
                'average'
              ), 
              ''
            ), 
            'FLOAT'
          )
        ),
        'avgRating'
      ]
    ],
    raw: true
  });
  
  const averageRating = avgRatingResult ? parseFloat((avgRatingResult as any).avgRating) || 0 : 0;
  
  // Monthly Sales Chart (Bar Chart) - Current Year
  const currentYear = new Date().getFullYear();
  const monthlyOrders = await Order.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"')), 'month'],
      [sequelize.fn('COUNT', sequelize.col('Order.id')), 'count']
    ],
    include: [{
      model: OrderItem,
      as: 'items',
      where: {
        productId: {
          [Op.in]: productIds
        }
      },
      attributes: []
    }],
    where: {
      createdAt: {
        [Op.gte]: new Date(currentYear, 0, 1),
        [Op.lt]: new Date(currentYear + 1, 0, 1)
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Sales Chart (Bar Chart) - Previous Year
  const previousYear = currentYear - 1;
  const previousYearMonthlyOrders = await Order.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"')), 'month'],
      [sequelize.fn('COUNT', sequelize.col('Order.id')), 'count']
    ],
    include: [{
      model: OrderItem,
      as: 'items',
      where: {
        productId: {
          [Op.in]: productIds
        }
      },
      attributes: []
    }],
    where: {
      createdAt: {
        [Op.gte]: new Date(previousYear, 0, 1),
        [Op.lt]: new Date(currentYear, 0, 1)
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Revenue Chart (Line Chart) - Current Year
  const monthlyRevenue = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"')), 'month'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Order,
      as: 'order',
      where: {
        createdAt: {
          [Op.gte]: new Date(currentYear, 0, 1),
          [Op.lt]: new Date(currentYear + 1, 0, 1)
        },
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }],
    where: {
      productId: {
        [Op.in]: productIds
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Revenue Chart (Line Chart) - Previous Year
  const previousYearMonthlyRevenue = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"')), 'month'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Order,
      as: 'order',
      where: {
        createdAt: {
          [Op.gte]: new Date(previousYear, 0, 1),
          [Op.lt]: new Date(currentYear, 0, 1)
        },
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }],
    where: {
      productId: {
        [Op.in]: productIds
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"'))],
    raw: true
  });
  
  // Products Distribution Chart (Doughnut Chart)
  const productDistribution = {
    published: publishedProducts,
    featured: featuredProducts,
    outOfStock: outOfStockProducts,
    lowStock: lowStockProducts
  };
  
  // Top Products Table (Data Grid)
  const topProducts = await OrderItem.findAll({
    attributes: [
      'productId',
      [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'unitsSold'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['name']
    }],
    where: {
      productId: {
        [Op.in]: productIds
      }
    },
    group: ['productId', 'product.id', 'product.name'],
    order: [[sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'DESC']],
    limit: 10,
    raw: true
  });
  
  // Top Suppliers Table
  const topSuppliers = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'totalRevenue'],
      [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'totalOrders']
    ],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['supplierId'],
      include: [{
        model: Supplier,
        as: 'supplier',
        attributes: ['name']
      }]
    }],
    group: [
      'product.supplierId',
      'product->supplier.id',
      'product->supplier.name'
    ],
    order: [[sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'DESC']],
    limit: 10,
    raw: true
  });
  
  // Return dashboard stats
  res.status(200).json({
    status: 'success',
    data: {
      supplier: {
        id: supplier.id,
        name: supplier.name,
      },
      stats: {
        products: {
          total: totalProducts,
          published: publishedProducts,
          featured: featuredProducts,
          outOfStock: outOfStockProducts,
          lowStock: lowStockProducts
        },
        orders: {
          recentCount: recentOrdersCount
        },
        revenue: {
          total: totalRevenue,
          recent: recentRevenue
        },
        rating: {
          average: parseFloat(averageRating.toFixed(1))
        }
      },
      monthlySales: {
        currentYear: monthlyOrders,
        previousYear: previousYearMonthlyOrders
      },
      monthlyRevenue: {
        currentYear: monthlyRevenue,
        previousYear: previousYearMonthlyRevenue
      },
      productDistribution,
      topProducts,
      topSuppliers
    },
  });
});

/**
 * Get admin dashboard statistics for all suppliers
 * @route GET /api/admin/stats
 * @access Private (Admin)
 */
export const getAdminStats = asyncHandler(async (req: Request, res: Response) => {
  // Verify authorization (admin or superadmin only)
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    throw new AppError('You are not authorized to view these statistics', 403);
  }

  // Get total suppliers count
  const totalSuppliers = await Supplier.count();
  
  // Get active suppliers count
  const activeSuppliers = await Supplier.count({
    where: { isActive: true }
  });
  
  // Get verified suppliers count
  const verifiedSuppliers = await Supplier.count({
    where: { isVerified: true }
  });

  // Get total products count
  const totalProducts = await Product.count();
  
  // Get published products count
  const publishedProducts = await Product.count({ 
    where: { isPublished: true } 
  });
  
  // Get featured products count
  const featuredProducts = await Product.count({ 
    where: { isFeatured: true } 
  });
  
  // Get products out of stock
  const outOfStockProducts = await Product.count({ 
    where: { 
      isDigital: false,
      quantity: 0
    } 
  });
  
  // Get products running low on stock
  const lowStockProducts = await Product.count({
    where: {
      isDigital: false,
      quantity: {
        [Op.gt]: 0,
        [Op.lte]: 10
      }
    }
  });

  // Get recent orders count (last 30 days)
  const recentOrdersCount = await Order.count({
    where: {
      createdAt: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  // Get total revenue from all time
  const totalRevenueResult = await OrderItem.sum('total', {
    include: [{
      model: Order,
      as: 'order',
      where: {
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }]
  });
  
  const totalRevenue = totalRevenueResult || 0;
  
  // Get total revenue from last 30 days
  const recentRevenueResult = await OrderItem.sum('total', {
    include: [{
      model: Order,
      as: 'order',
      where: {
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        },
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: []
    }]
  });
  
  const recentRevenue = recentRevenueResult || 0;

  // Get average rating across all products
  const avgRatingResult = await Product.findOne({
    where: {
      metadata: {
        [Op.ne]: null
      }
    },
    attributes: [
      [
        sequelize.fn('AVG', 
          sequelize.cast(
            sequelize.fn('NULLIF', 
              sequelize.fn('JSONB_EXTRACT_PATH_TEXT', 
                sequelize.col('metadata'), 
                'rating', 
                'average'
              ), 
              ''
            ), 
            'FLOAT'
          )
        ),
        'avgRating'
      ]
    ],
    raw: true
  });
  
  const averageRating = avgRatingResult ? parseFloat((avgRatingResult as any).avgRating) || 0 : 0;

  // Monthly Sales Chart (Bar Chart) - Current Year
  const currentYear = new Date().getFullYear();
  const monthlyOrders = await Order.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"')), 'month'],
      [sequelize.fn('COUNT', sequelize.col('Order.id')), 'count']
    ],
    where: {
      createdAt: {
        [Op.gte]: new Date(currentYear, 0, 1),
        [Op.lt]: new Date(currentYear + 1, 0, 1)
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Sales Chart (Bar Chart) - Previous Year
  const previousYear = currentYear - 1;
  const previousYearMonthlyOrders = await Order.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"')), 'month'],
      [sequelize.fn('COUNT', sequelize.col('Order.id')), 'count']
    ],
    where: {
      createdAt: {
        [Op.gte]: new Date(previousYear, 0, 1),
        [Op.lt]: new Date(currentYear, 0, 1)
      }
    },
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Revenue Chart (Line Chart) - Current Year
  const monthlyRevenue = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"')), 'month'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Order,
      as: 'order',
      where: {
        createdAt: {
          [Op.gte]: new Date(currentYear, 0, 1),
          [Op.lt]: new Date(currentYear + 1, 0, 1)
        },
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }],
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"'))],
    raw: true
  });
  
  // Monthly Revenue Chart (Line Chart) - Previous Year
  const previousYearMonthlyRevenue = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"')), 'month'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Order,
      as: 'order',
      where: {
        createdAt: {
          [Op.gte]: new Date(previousYear, 0, 1),
          [Op.lt]: new Date(currentYear, 0, 1)
        },
        status: {
          [Op.notIn]: ['cancelled', 'refunded']
        }
      },
      attributes: []
    }],
    group: [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "order"."createdAt"'))],
    raw: true
  });

  // Products Distribution Chart (Doughnut Chart)
  const productDistribution = {
    published: publishedProducts,
    featured: featuredProducts,
    outOfStock: outOfStockProducts,
    lowStock: lowStockProducts
  };

  // Top Products Table (Data Grid)
  const topProducts = await OrderItem.findAll({
    attributes: [
      'productId',
      [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'unitsSold'],
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'revenue']
    ],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['name', 'supplierId'],
      include: [{
        model: Supplier,
        as: 'supplier',
        attributes: ['name']
      }]
    }],
    group: ['productId', 'product.id', 'product.name', 'product.supplierId', 'product->supplier.id', 'product->supplier.name'],
    order: [[sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'DESC']],
    limit: 10,
    raw: true
  });

  // Top Suppliers Table
  const topSuppliers = await OrderItem.findAll({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'totalRevenue'],
      [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'totalOrders']
    ],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['supplierId'],
      include: [{
        model: Supplier,
        as: 'supplier',
        attributes: ['name']
      }]
    }],
    group: [
      'product.supplierId',
      'product->supplier.id',
      'product->supplier.name'
    ],
    order: [[sequelize.fn('SUM', sequelize.col('OrderItem.total')), 'DESC']],
    limit: 10,
    raw: true
  });

  // Return admin dashboard stats
  res.status(200).json({
    status: 'success',
    data: {
      suppliers: {
        total: totalSuppliers,
        active: activeSuppliers,
        verified: verifiedSuppliers
      },
      products: {
        total: totalProducts,
        published: publishedProducts,
        featured: featuredProducts,
        outOfStock: outOfStockProducts,
        lowStock: lowStockProducts
      },
      orders: {
        recentCount: recentOrdersCount
      },
      revenue: {
        total: totalRevenue,
        recent: recentRevenue
      },
      rating: {
        average: parseFloat(averageRating.toFixed(1))
      },
      monthlySales: {
        currentYear: monthlyOrders,
        previousYear: previousYearMonthlyOrders
      },
      monthlyRevenue: {
        currentYear: monthlyRevenue,
        previousYear: previousYearMonthlyRevenue
      },
      productDistribution,
      topProducts,
      topSuppliers
    }
  });
});

/**
 * Update supplier public information
 * @route PUT /api/suppliers/me
 * @access Private (Supplier)
 */
export const updateSupplierPublicInfo = asyncHandler(async (req: Request, res: Response) => {
  // Verify that the user is a supplier
  if (req.user.role !== 'supplier') {
    throw new AppError('Only suppliers can update their public information', 403);
  }

  const supplierId = req.user.id;
  
  // Check if supplier exists
  const supplier = await Supplier.findByPk(supplierId);
  
  if (!supplier) {
    throw new AppError('Supplier not found', 404);
  }
  
  const {
    name,
    email,
    contactPerson,
    phone,
    address,
    website,
    description,
    tin,
    bio,
    businessAddress,
    companyName,
    taxId
  } = req.body;
  
  // Check if email is being changed and is already in use
  if (email && email !== supplier.email) {
    const existingSupplier = await Supplier.findOne({ where: { email } });
    if (existingSupplier) {
      throw new AppError('Email already in use', 400);
    }
  }
  
  // Update only public fields
  if (name) supplier.name = name;
  if (email) supplier.email = email;
  if (contactPerson) supplier.contactPerson = contactPerson;
  if (phone !== undefined) supplier.phone = phone;
  if (address !== undefined) supplier.address = address;
  if (website !== undefined) supplier.website = website;
  if (description !== undefined) supplier.description = description;
  if (tin !== undefined) supplier.tin = tin;
  if (bio !== undefined) supplier.bio = bio;
  if (businessAddress !== undefined) supplier.businessAddress = businessAddress;
  if (companyName !== undefined) supplier.companyName = companyName;
  if (taxId !== undefined) supplier.taxId = taxId;
  
  await supplier.save();
  
  // Remove password from response
  const supplierData = supplier.toJSON();
  
  res.status(200).json({
    status: 'success',
    data: {
      supplier: supplierData,
    },
  });
});

export default {
  getSuppliers,
  getSupplierById,
  getSupplierProducts,
  getSupplierOrders,
  createSupplier,
  updateSupplier,
  updateSupplierPassword,
  deleteSupplier,
  getSupplierStats,
  getAdminStats,
  updateSupplierPublicInfo
};