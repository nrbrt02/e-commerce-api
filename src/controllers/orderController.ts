import { Request, Response } from 'express';
import Order, { OrderStatus, PaymentStatus } from '../models/Order';
import OrderItem from '../models/OrderItem';
import Product from '../models/Product';
import Customer from '../models/Customer';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Op } from 'sequelize';
import sequelize from '../config/db';

/**
 * Get all orders
 * @route GET /api/orders
 * @access Private (Admin)
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {
    where: {},
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone'],
      },
    ],
  };
  
  // Filter by status
  if (req.query.status) {
    queryBuilder.where.status = req.query.status;
  }
  
  // Filter by payment status
  if (req.query.paymentStatus) {
    queryBuilder.where.paymentStatus = req.query.paymentStatus;
  }
  
  // Filter by customer
  if (req.query.customer) {
    queryBuilder.where.customerId = req.query.customer;
  }
  
  // Filter by date range
  if (req.query.startDate) {
    queryBuilder.where.createdAt = {
      ...queryBuilder.where.createdAt,
      [Op.gte]: new Date(req.query.startDate as string),
    };
  }
  
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate as string);
    endDate.setHours(23, 59, 59, 999); // End of the day
    
    queryBuilder.where.createdAt = {
      ...queryBuilder.where.createdAt,
      [Op.lte]: endDate,
    };
  }
  
  // Filter by minimum order amount
  if (req.query.minAmount) {
    queryBuilder.where.totalAmount = {
      ...queryBuilder.where.totalAmount,
      [Op.gte]: parseFloat(req.query.minAmount as string),
    };
  }
  
  // Filter by maximum order amount
  if (req.query.maxAmount) {
    queryBuilder.where.totalAmount = {
      ...queryBuilder.where.totalAmount,
      [Op.lte]: parseFloat(req.query.maxAmount as string),
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
      orders,
    },
  });
});

/**
 * Get a single order
 * @route GET /api/orders/:id
 * @access Private (Admin, Customer)
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone'],
      },
    ],
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // If the user is a customer, ensure they can only access their own orders
  if (req.user && !await req.user.hasRole('admin')) {
    // For customers, check if this is their order
    if (order.customerId !== req.user.id) {
      throw new AppError('You do not have permission to access this order', 403);
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      order,
    },
  });
});

/**
 * Create a new order
 * @route POST /api/orders
 * @access Private (Customer)
 */

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingMethod,
      notes,
    } = req.body;
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Order must contain at least one item', 400);
    }
    
    if (!shippingAddress) {
      throw new AppError('Shipping address is required', 400);
    }
    
    if (!billingAddress) {
      throw new AppError('Billing address is required', 400);
    }
    
    // Get customer ID from authenticated user
    const customerId = req.user!.id;
    
    // Initialize order totals
    let subtotal = 0;
    let taxAmount = 0;
    let shippingAmount = 0;
    let discountAmount = 0;
    
    // Validate items and calculate totals
    const orderItems = [];
    
    for (const item of items) {
      // Validate item
      if (!item.productId || !item.quantity) {
        throw new AppError('Invalid order item', 400);
      }
      
      // Get product
      const product = await Product.findByPk(item.productId, { transaction });
      
      if (!product) {
        throw new AppError(`Product with ID ${item.productId} not found`, 404);
      }
      
      if (!product.isPublished) {
        throw new AppError(`Product ${product.name} is not available for purchase`, 400);
      }
      
      if (!product.isDigital && product.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for product ${product.name}`, 400);
      }
      
      // Calculate item totals
      const itemSubtotal = parseFloat(product.price.toString()) * item.quantity;
      subtotal += itemSubtotal;
      
      // Apply tax if applicable (assuming 10% tax)
      const itemTax = itemSubtotal * 0.1;
      taxAmount += itemTax;
      
      // Create order item
      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice: parseFloat(product.price.toString()),
        subtotal: itemSubtotal,
        taxAmount: itemTax,
        discountAmount: 0, // Apply discounts if needed
        totalAmount: itemSubtotal + itemTax,
      });
      
      // Update product stock if not digital
      if (!product.isDigital) {
        product.quantity -= item.quantity;
        await product.save({ transaction });
      }
    }
    
    // Apply shipping amount based on shipping method (simplified example)
    if (shippingMethod === 'express') {
      shippingAmount = 15;
    } else {
      shippingAmount = 5;
    }
    
    // Calculate total amount
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;
    
    // Generate order number
    const generateOrderNumber = (): string => {
      const timestamp = Date.now().toString();
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `ORD-${timestamp.substring(timestamp.length - 6)}${randomNum}`;
    };
    
    // Create order
    const order = await Order.create(
      {
        orderNumber: generateOrderNumber(), // Add order number
        customerId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: paymentMethod || 'credit_card',
        currency: 'USD',
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount,
        totalAmount,
        shippingAddressId: req.body.shippingAddressId,
        billingAddressId: req.body.billingAddressId,
        shippingMethod,
        notes,
      },
      { transaction }
    );
    
    // Create order items
    for (const item of orderItems) {
      await OrderItem.create(
        {
          ...item,
          orderId: order.id,
        },
        { transaction }
      );
    }
    
    // Commit transaction
    await transaction.commit();
    
    // Fetch the complete order with items
    const completeOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone'],
        },
      ],
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        order: completeOrder,
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    throw error;
  }
});

/**
 * Update order status
 * @route PATCH /api/orders/:id/status
 * @access Private (Admin)
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  
  // Validate status
  if (!status || !Object.values(OrderStatus).includes(status as OrderStatus)) {
    throw new AppError('Invalid order status', 400);
  }
  
  // Find order
  const order = await Order.findByPk(req.params.id);
  
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  
  // Update status
  order.status = status as OrderStatus;
  await order.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      order,
    },
  });
});

/**
 * Update payment status
 * @route PATCH /api/orders/:id/payment
 * @access Private (Admin)
 */
export const updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { paymentStatus, paymentDetails } = req.body;
  
  // Validate payment status
  if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
    throw new AppError('Invalid payment status', 400);
  }
  
  // Find order
  const order = await Order.findByPk(req.params.id);
  
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  
  // Update payment status and details
  order.paymentStatus = paymentStatus as PaymentStatus;
  
  if (paymentDetails) {
    order.paymentDetails = paymentDetails;
  }
  
  await order.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      order,
    },
  });
});

/**
 * Cancel an order
 * @route PATCH /api/orders/:id/cancel
 * @access Private (Admin, Customer)
 */

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Find order with items
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
            },
          ],
        },
      ],
      transaction,
    });
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    
    // Check if order can be cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError('Order is already cancelled', 400);
    }
    
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.REFUNDED) {
      throw new AppError('Cannot cancel an order that is already delivered or refunded', 400);
    }
    
    // If the user is a customer, ensure they can only cancel their own orders
    if (req.user && !await req.user.hasRole('admin')) {
      // For customers, check if this is their order
      if (order.customerId !== req.user.id) {
        throw new AppError('You do not have permission to cancel this order', 403);
      }
    }
    
    // Return items to inventory if they're not digital
    const items = await order.getItems();
    
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction });
      
      if (product && !product.isDigital) {
        product.quantity += item.quantity;
        await product.save({ transaction });
      }
    }
    
    // Update order status
    order.status = OrderStatus.CANCELLED;
    
    // Update payment status if needed
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
    }
    
    await order.save({ transaction });
    
    // Commit transaction
    await transaction.commit();
    
    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get customer orders
 * @route GET /api/orders/my-orders
 * @access Private (Customer)
 */
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  // Get customer ID from authenticated user
  const customerId = req.user!.id;
  
  // Build query
  const queryBuilder: any = {
    where: {
      customerId,
    },
    include: [
      {
        model: OrderItem,
        as: 'items',
      },
    ],
  };
  
  // Filter by status
  if (req.query.status) {
    queryBuilder.where.status = req.query.status;
  }
  
  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  queryBuilder.limit = limit;
  queryBuilder.offset = offset;
  
  // Sorting (newest first by default)
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
      orders,
    },
  });
});