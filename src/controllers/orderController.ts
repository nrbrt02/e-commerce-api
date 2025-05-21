import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { Op } from "sequelize";
import { models, sequelize } from "../models";
import { OrderStatus, PaymentStatus } from "../models/Order";

// Destructure models from the imported models object
const { Order, OrderItem, Product, Customer } = models;

/**
 * Get all orders
 * @route GET /api/orders
 * @access Private (Admin)
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  // Build query with proper typing
  const queryBuilder: {
    where: any;
    include: any[];
    limit?: number;
    offset?: number;
    order?: any[];
  } = {
    where: {},
    include: [
      {
        model: OrderItem,
        as: "items",
      },
      {
        model: Customer,
        as: "customer",
        attributes: [
          "id",
          "username",
          "email",
          "firstName",
          "lastName",
          "phone",
        ],
      },
    ],
  };

  // Filter by status with type checking
  if (
    req.query.status &&
    Object.values(OrderStatus).includes(req.query.status as OrderStatus)
  ) {
    queryBuilder.where.status = req.query.status;
  }

  // Filter by payment status with type checking
  if (
    req.query.paymentStatus &&
    Object.values(PaymentStatus).includes(
      req.query.paymentStatus as PaymentStatus
    )
  ) {
    queryBuilder.where.paymentStatus = req.query.paymentStatus;
  }

  // Filter by customer with validation
  if (req.query.customer) {
    const customerId = parseInt(req.query.customer as string);
    if (!isNaN(customerId)) {
      queryBuilder.where.customerId = customerId;
    }
  }

  // Filter by date range with validation
  if (req.query.startDate) {
    const startDate = new Date(req.query.startDate as string);
    if (!isNaN(startDate.getTime())) {
      queryBuilder.where.createdAt = {
        ...queryBuilder.where.createdAt,
        [Op.gte]: startDate,
      };
    }
  }

  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate as string);
    if (!isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      queryBuilder.where.createdAt = {
        ...queryBuilder.where.createdAt,
        [Op.lte]: endDate,
      };
    }
  }

  // Filter by minimum order amount with validation
  if (req.query.minAmount) {
    const minAmount = parseFloat(req.query.minAmount as string);
    if (!isNaN(minAmount)) {
      queryBuilder.where.totalAmount = {
        ...queryBuilder.where.totalAmount,
        [Op.gte]: minAmount,
      };
    }
  }

  // Filter by maximum order amount with validation
  if (req.query.maxAmount) {
    const maxAmount = parseFloat(req.query.maxAmount as string);
    if (!isNaN(maxAmount)) {
      queryBuilder.where.totalAmount = {
        ...queryBuilder.where.totalAmount,
        [Op.lte]: maxAmount,
      };
    }
  }

  // Pagination with validation
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  queryBuilder.limit = limit;
  queryBuilder.offset = offset;

  // Sorting with validation
  const sortField = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
  queryBuilder.order = [[sortField as string, sortOrder]];

  // Execute query with proper error handling
  const { count, rows: orders } = await Order.findAndCountAll(queryBuilder);

  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    status: "success",
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
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new AppError("Invalid order ID", 400);
    }

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: "items",
        },
        {
          model: Customer,
          as: "customer",
          attributes: [
            "id",
            "username",
            "email",
            "firstName",
            "lastName",
            "phone",
          ],
        },
      ],
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // If the user is a customer, ensure they can only access their own orders
    if (req.user && !(await req.user.hasRole("admin"))) {
      if (order.customerId !== req.user.id) {
        throw new AppError(
          "You do not have permission to access this order",
          403
        );
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  }
);

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
      throw new AppError("Order must contain at least one item", 400);
    }

    if (!shippingAddress) {
      throw new AppError("Shipping address is required", 400);
    }

    if (!billingAddress) {
      throw new AppError("Billing address is required", 400);
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
      if ((!item.productId && !item.id) || !item.quantity) {
        throw new AppError("Invalid order item", 400);
      }

      // Use productId if available, otherwise use id
      const productId = item.productId || item.id;

      const product = await Product.findByPk(productId, { transaction });

      if (!product) {
        throw new AppError(`Product with ID ${productId} not found`, 404);
      }

      if (!product.isPublished) {
        throw new AppError(
          `Product ${product.name} is not available for purchase`,
          400
        );
      }

      if (!product.isDigital && product.quantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for product ${product.name}`,
          400
        );
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
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: parseFloat(product.price.toString()),
        subtotal: itemSubtotal,
        discount: 0,
        tax: itemTax,
        total: itemSubtotal + itemTax,
      });

      // Update product stock if not digital
      if (!product.isDigital) {
        product.quantity -= item.quantity;
        await product.save({ transaction });
      }
    }

    // Apply shipping amount based on shipping method
    if (shippingMethod === "express") {
      shippingAmount = 15;
    } else {
      shippingAmount = 5;
    }

    // Calculate total amount
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    // Generate order number
    const generateOrderNumber = (): string => {
      const timestamp = Date.now().toString();
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      return `ORD-${timestamp.substring(timestamp.length - 6)}${randomNum}`;
    };

    // Create order
    const order = await Order.create(
      {
        orderNumber: generateOrderNumber(),
        customerId,
        status: OrderStatus.PENDING,
        totalAmount,
        totalItems: items.length,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: paymentMethod || "credit_card",
        paymentDetails: {},
        shippingMethod,
        shippingAddress,
        billingAddress,
        notes,
        metadata: {},
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
          as: "items",
        },
        {
          model: Customer,
          as: "customer",
          attributes: [
            "id",
            "username",
            "email",
            "firstName",
            "lastName",
            "phone",
          ],
        },
      ],
    });

    res.status(201).json({
      status: "success",
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
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new AppError("Invalid order ID", 400);
    }

    const { status } = req.body;

    // Validate status
    if (
      !status ||
      !Object.values(OrderStatus).includes(status as OrderStatus)
    ) {
      throw new AppError("Invalid order status", 400);
    }

    // Find order
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Update status
    order.status = status as OrderStatus;
    await order.save();

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  }
);

/**
 * Update payment status
 * @route PATCH /api/orders/:id/payment
 * @access Private (Admin)
 */
export const updatePaymentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      throw new AppError("Invalid order ID", 400);
    }

    const { paymentStatus, paymentDetails } = req.body;

    // Validate payment status
    if (
      !paymentStatus ||
      !Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
    ) {
      throw new AppError("Invalid payment status", 400);
    }

    // Find order
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Update payment status and details
    order.paymentStatus = paymentStatus as PaymentStatus;

    if (paymentDetails) {
      order.paymentDetails = paymentDetails;
    }

    await order.save();

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  }
);

/**
 * Cancel an order
 * @route PATCH /api/orders/:id/cancel
 * @route PUT /api/orders/:id/cancel
 * @access Private (Admin, Customer)
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  // Extract the cancellation reason from request body (optional)
  const { reason } = req.body;
  
  const transaction = await sequelize.transaction();

  try {
    // Find order with items
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
            },
          ],
        },
      ],
      transaction,
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Check if order can be cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError("Order is already cancelled", 400);
    }

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new AppError(
        "Cannot cancel an order that is already delivered or refunded",
        400
      );
    }

    // If the user is a customer, ensure they can only cancel their own orders
    if (req.user && !(await req.user.hasRole("admin"))) {
      if (order.customerId !== req.user.id) {
        throw new AppError(
          "You do not have permission to cancel this order",
          403
        );
      }
    }

    // Return items to inventory if they're not digital
    for (const item of order.items) {
      if (!item.product.isDigital) {
        item.product.quantity += item.quantity;
        await item.product.save({ transaction });
      }
    }

    // Update order status
    order.status = OrderStatus.CANCELLED;

    // Update payment status if needed
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
    }
    
    // Store cancellation details in metadata
    const metadata = order.metadata || {};
    const cancellationDetails = {
      cancelledAt: new Date(),
      cancelledBy: req.user.role,
      cancelledById: req.user.id,
      reason: reason || 'No reason provided'
    };
    
    // Update metadata with cancellation info
    order.metadata = {
      ...metadata,
      cancellation: cancellationDetails
    };

    await order.save({ transaction });

    // Commit transaction
    await transaction.commit();

    res.status(200).json({
      status: "success",
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

  // Build query with proper typing
  const queryBuilder: {
    where: any;
    include: any[];
    limit?: number;
    offset?: number;
    order?: any[];
  } = {
    where: {
      customerId,
    },
    include: [
      {
        model: OrderItem,
        as: "items",
      },
    ],
  };

  // Filter by status with type checking
  if (
    req.query.status &&
    Object.values(OrderStatus).includes(req.query.status as OrderStatus)
  ) {
    queryBuilder.where.status = req.query.status;
  }

  // Pagination with validation
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  queryBuilder.limit = limit;
  queryBuilder.offset = offset;

  // Sorting with validation
  const sortField = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
  queryBuilder.order = [[sortField as string, sortOrder]];

  // Execute query with proper error handling
  const { count, rows: orders } = await Order.findAndCountAll(queryBuilder);

  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    status: "success",
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
 * Save order as draft
 * @route POST /api/orders/draft
 * @access Private (Customer)
 */
export const saveOrderDraft = asyncHandler(
  async (req: Request, res: Response) => {
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

      // Validate items (can be empty for draft)
      if (items && !Array.isArray(items)) {
        throw new AppError("Items must be an array", 400);
      }

      // Get customer ID from authenticated user
      const customerId = req.user!.id;

      // Initialize order totals
      let subtotal = 0;
      let taxAmount = 0;
      let shippingAmount = 0;
      let discountAmount = 0;
      let totalItems = 0;

      // Process items if provided
      const orderItems = [];

      if (items && items.length > 0) {
        totalItems = items.length;

        for (const item of items) {
          // Validate item
          if ((!item.productId && !item.id) || !item.quantity) {
            throw new AppError("Invalid order item", 400);
          }

          // Use productId if available, otherwise use id
          const productId = item.productId || item.id;

          // Get product
          const product = await Product.findByPk(productId, {
            transaction,
          });

          if (!product) {
            throw new AppError(
              `Product with ID ${productId} not found`,
              404
            );
          }

          // Calculate item totals
          const itemSubtotal =
            parseFloat(product.price.toString()) * item.quantity;
          subtotal += itemSubtotal;

          // Apply tax if applicable (assuming 10% tax)
          const itemTax = itemSubtotal * 0.1;
          taxAmount += itemTax;

          // Create order item
          orderItems.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: item.quantity,
            unitPrice: parseFloat(product.price.toString()),
            subtotal: itemSubtotal,
            discount: 0,
            tax: itemTax,
            total: itemSubtotal + itemTax,
          });
        }

        // Apply shipping amount based on shipping method
        if (shippingMethod === "express") {
          shippingAmount = 15;
        } else if (shippingMethod) {
          shippingAmount = 5;
        }
      }

      // Calculate total amount
      const totalAmount =
        subtotal + taxAmount + shippingAmount - discountAmount;

      // Generate order number
      const generateOrderNumber = (): string => {
        const prefix = "DFT";
        const timestamp = Date.now().toString();
        const randomNum = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        return `${prefix}-${timestamp.substring(
          timestamp.length - 6
        )}${randomNum}`;
      };

      // Create draft order
      const draftOrder = await Order.create(
        {
          orderNumber: generateOrderNumber(),
          customerId,
          status: OrderStatus.DRAFT,
          totalAmount,
          totalItems,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: paymentMethod || null,
          paymentDetails: {},
          shippingMethod,
          shippingAddress,
          billingAddress,
          notes,
          metadata: {
            isDraft: true,
            draftSavedAt: new Date().toISOString(),
          },
        },
        { transaction }
      );

      // Create order items if any
      if (orderItems.length > 0) {
        for (const item of orderItems) {
          await OrderItem.create(
            {
              ...item,
              orderId: draftOrder.id,
            },
            { transaction }
          );
        }
      }

      // Commit transaction
      await transaction.commit();

      // Fetch the complete draft order with items
      const completeDraftOrder = await Order.findByPk(draftOrder.id, {
        include: [
          {
            model: OrderItem,
            as: "items",
          },
        ],
      });

      res.status(201).json({
        status: "success",
        data: {
          order: completeDraftOrder,
        },
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
);

/**
 * Update an order draft
 * @route PUT /api/orders/draft/:id
 * @access Private (Customer)
 */
export const updateOrderDraft = asyncHandler(
  async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);
    if (isNaN(draftId)) {
      throw new AppError("Invalid draft ID", 400);
    }

    const transaction = await sequelize.transaction();

    try {
      // Find the draft order
      const draftOrder = await Order.findByPk(draftId, {
        include: [
          {
            model: OrderItem,
            as: "items",
          },
        ],
        transaction,
      });

      if (!draftOrder) {
        throw new AppError("Draft order not found", 404);
      }

      // Ensure it's a draft
      if (draftOrder.status !== OrderStatus.DRAFT) {
        throw new AppError("This order is not a draft", 400);
      }

      // Check if user owns this draft
      if (draftOrder.customerId !== req.user!.id) {
        throw new AppError(
          "You do not have permission to update this draft",
          403
        );
      }

      const {
        items,
        shippingAddress,
        billingAddress,
        paymentMethod,
        shippingMethod,
        notes,
        total,
        shipping,
        lastUpdated
      } = req.body;

      // Validate items (can be empty for draft)
      if (items && !Array.isArray(items)) {
        throw new AppError("Items must be an array", 400);
      }

      // Initialize order totals
      let subtotal = 0;
      let taxAmount = 0;
      let shippingAmount = 0;
      let discountAmount = 0;
      let totalItems = 0;

      // If items are provided, remove existing items and add new ones
      if (items) {
        totalItems = items.length;

        // Remove existing items
        await OrderItem.destroy({
          where: { orderId: draftOrder.id },
          transaction,
        });

        // Process new items
        const orderItems = [];

        if (items.length > 0) {
          for (const item of items) {
            // Validate item
            if ((!item.productId && !item.id) || !item.quantity) {
              throw new AppError("Invalid order item", 400);
            }

            // Use productId if available, otherwise use id
            const productId = item.productId || item.id;

            // Get product
            const product = await Product.findByPk(productId, {
              transaction,
            });

            if (!product) {
              throw new AppError(
                `Product with ID ${productId} not found`,
                404
              );
            }

            // Calculate item totals
            const itemSubtotal =
              parseFloat(product.price.toString()) * item.quantity;
            subtotal += itemSubtotal;

            // Apply tax if applicable (assuming 10% tax)
            const itemTax = itemSubtotal * 0.1;
            taxAmount += itemTax;

            // Create order item
            orderItems.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              quantity: item.quantity,
              unitPrice: parseFloat(product.price.toString()),
              subtotal: itemSubtotal,
              discount: 0,
              tax: itemTax,
              total: itemSubtotal + itemTax,
            });
          }
        }

        // Apply shipping amount based on shipping method
        if (shippingMethod === "express") {
          shippingAmount = 15;
        } else if (shippingMethod) {
          shippingAmount = 5;
        }

        // Create order items if any
        if (orderItems.length > 0) {
          for (const item of orderItems) {
            await OrderItem.create(
              {
                ...item,
                orderId: draftOrder.id,
              },
              { transaction }
            );
          }
        }
      }

      // Calculate total amount - use provided total if available, otherwise calculate
      const totalAmount = total !== undefined ? total : (subtotal + taxAmount + shippingAmount - discountAmount);

      // Update draft order
      await draftOrder.update(
        {
          totalAmount: totalAmount,
          totalItems: items ? totalItems : draftOrder.totalItems,
          paymentMethod:
            paymentMethod !== undefined
              ? paymentMethod
              : draftOrder.paymentMethod,
          paymentDetails:
            req.body.paymentDetails !== undefined
              ? req.body.paymentDetails
              : draftOrder.paymentDetails,
          shippingMethod:
            shippingMethod !== undefined
              ? shippingMethod
              : draftOrder.shippingMethod,
          shippingAddress:
            shippingAddress !== undefined
              ? shippingAddress
              : draftOrder.shippingAddress,
          billingAddress:
            billingAddress !== undefined
              ? billingAddress
              : draftOrder.billingAddress,
          notes: notes !== undefined ? notes : draftOrder.notes,
          metadata: {
            ...(draftOrder.metadata || {}),
            isDraft: true,
            draftLastUpdatedAt: lastUpdated || new Date().toISOString(),
            totalAmount: totalAmount,
            shipping: shipping || shippingAmount
          },
        },
        { transaction }
      );

      // Commit transaction
      await transaction.commit();

      // Fetch the updated draft order with items
      const updatedDraftOrder = await Order.findByPk(draftOrder.id, {
        include: [
          {
            model: OrderItem,
            as: "items",
          },
        ],
      });

      res.status(200).json({
        status: "success",
        data: {
          order: updatedDraftOrder,
        },
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
);

/**
 * Get customer draft orders
 * @route GET /api/orders/drafts
 * @access Private (Customer)
 */
export const getMyDraftOrders = asyncHandler(
  async (req: Request, res: Response) => {
    // Get customer ID from authenticated user
    const customerId = req.user!.id;

    // Build query with proper typing
    const queryBuilder: {
      where: any;
      include: any[];
      limit?: number;
      offset?: number;
      order?: any[];
    } = {
      where: {
        customerId,
        status: OrderStatus.DRAFT,
      },
      include: [
        {
          model: OrderItem,
          as: "items",
        },
      ],
    };

    // Pagination with validation
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    queryBuilder.limit = limit;
    queryBuilder.offset = offset;

    // Sorting with validation
    const sortField = req.query.sortBy || "updatedAt";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
    queryBuilder.order = [[sortField as string, sortOrder]];

    // Execute query with proper error handling
    const { count, rows: drafts } = await Order.findAndCountAll(queryBuilder);

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: "success",
      results: drafts.length,
      pagination: {
        totalDrafts: count,
        totalPages,
        currentPage: page,
        limit,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      data: {
        drafts,
      },
    });
  }
);

/**
 * Get customer draft order by ID
 * @route GET /api/orders/drafts/:id
 * @access Private (Customer)
 */
export const getMyDraftOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    // Get customer ID from authenticated user
    const customerId = req.user!.id;

    // Get order ID from route parameters
    const orderId = req.params.id;

    // Find the draft order with proper typing
    const draft = await Order.findOne({
      where: {
        id: orderId,
        customerId,
        status: OrderStatus.DRAFT,
      },
      include: [
        {
          model: OrderItem,
          as: "items",
        },
      ],
    });

    // Check if draft exists
    if (!draft) {
      return res.status(404).json({
        status: "fail",
        message: "Draft order not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        draft,
      },
    });
  }
);

/**
 * Delete an order draft
 * @route DELETE /api/orders/draft/:id
 * @access Private (Customer)
 */
export const deleteOrderDraft = asyncHandler(
  async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);
    if (isNaN(draftId)) {
      throw new AppError("Invalid draft ID", 400);
    }

    const transaction = await sequelize.transaction();

    try {
      // Find the draft order
      const draftOrder = await Order.findByPk(draftId, { transaction });

      if (!draftOrder) {
        throw new AppError("Draft order not found", 404);
      }

      // Ensure it's a draft
      if (draftOrder.status !== OrderStatus.DRAFT) {
        throw new AppError("This order is not a draft", 400);
      }

      // Check if user owns this draft
      if (draftOrder.customerId !== req.user!.id) {
        throw new AppError(
          "You do not have permission to delete this draft",
          403
        );
      }

      // Delete all associated order items
      await OrderItem.destroy({
        where: { orderId: draftOrder.id },
        transaction,
      });

      // Delete the draft order
      await draftOrder.destroy({ transaction });

      // Commit transaction
      await transaction.commit();

      res.status(200).json({
        status: "success",
        message: "Draft order deleted successfully",
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
);

/**
 * Convert a draft to a regular order
 * @route POST /api/orders/draft/:id/convert
 * @access Private (Customer)
 */
export const convertDraftToOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const draftId = parseInt(req.params.id);
    if (isNaN(draftId)) {
      throw new AppError("Invalid draft ID", 400);
    }

    const transaction = await sequelize.transaction();

    try {
      // Find the draft order
      const draftOrder = await Order.findByPk(draftId, {
        include: [
          {
            model: OrderItem,
            as: "items",
            include: [
              {
                model: Product,
                as: "product",
              },
            ],
          },
        ],
        transaction,
      });

      if (!draftOrder) {
        throw new AppError("Draft order not found", 404);
      }

      // Ensure it's a draft
      if (draftOrder.status !== OrderStatus.DRAFT) {
        throw new AppError("This order is not a draft", 400);
      }

      // Check if user owns this draft
      if (draftOrder.customerId !== req.user!.id) {
        throw new AppError(
          "You do not have permission to convert this draft",
          403
        );
      }

      // Validate required fields for a proper order
      if (!draftOrder.items || draftOrder.items.length === 0) {
        throw new AppError(
          "Draft order must contain at least one item to be converted",
          400
        );
      }

      if (!draftOrder.shippingAddress) {
        throw new AppError(
          "Shipping address is required to convert draft to order",
          400
        );
      }

      if (!draftOrder.billingAddress) {
        throw new AppError(
          "Billing address is required to convert draft to order",
          400
        );
      }

      // Check product inventory and update stock
      for (const item of draftOrder.items) {
        const product = item.product;

        if (!product.isPublished) {
          throw new AppError(
            `Product ${product.name} is not available for purchase`,
            400
          );
        }

        if (!product.isDigital && product.quantity < item.quantity) {
          throw new AppError(
            `Insufficient stock for product ${product.name}`,
            400
          );
        }

        // Update product stock if not digital
        if (!product.isDigital) {
          product.quantity -= item.quantity;
          await product.save({ transaction });
        }
      }

      // Generate a regular order number
      const generateOrderNumber = (): string => {
        const prefix = "ORD";
        const timestamp = Date.now().toString();
        const randomNum = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        return `${prefix}-${timestamp.substring(
          timestamp.length - 6
        )}${randomNum}`;
      };

      // Update metadata
      const metadata = {
        ...(draftOrder.metadata || {}),
        isDraft: false,
        convertedFromDraft: true,
        draftOrderNumber: draftOrder.orderNumber,
        convertedAt: new Date().toISOString(),
      };

      // Convert draft to regular order
      await draftOrder.update(
        {
          orderNumber: generateOrderNumber(),
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          metadata,
        },
        { transaction }
      );

      // Commit transaction
      await transaction.commit();

      // Fetch the updated order with items
      const convertedOrder = await Order.findByPk(draftOrder.id, {
        include: [
          {
            model: OrderItem,
            as: "items",
          },
        ],
      });

      res.status(200).json({
        status: "success",
        data: {
          order: convertedOrder,
        },
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
);

/**
 * Get supplier orders (orders containing their products)
 * @route GET /api/orders/supplier-orders
 * @access Private (Supplier)
 */
export const getSupplierOrders = asyncHandler(async (req: Request, res: Response) => {
  // Get supplier ID from authenticated user
  const supplierId = req.user!.id;

  // First find all order items that belong to this supplier's products
  const orderItems = await OrderItem.findAll({
    include: [{
      model: Product,
      as: 'product',
      where: { supplierId },
      attributes: [] // We don't need product details
    }],
    attributes: ['orderId'], // We only need the order IDs
    group: ['orderId'], // Group by order to avoid duplicates
    raw: true
  });

  // Define type for the order items
  interface OrderItemResult {
    orderId: number;
  }

  // Extract the unique order IDs with proper typing
  const orderIds: number[] = orderItems.map((item: OrderItemResult) => item.orderId);

  // If no orders found, return empty array
  if (orderIds.length === 0) {
    return res.status(200).json({
      status: "success",
      results: 0,
      pagination: {
        totalOrders: 0,
        totalPages: 0,
        currentPage: 1,
        limit: 20,
        hasPrevPage: false,
        hasNextPage: false,
      },
      data: {
        orders: [],
      },
    });
  }

  // Build query for the orders with proper typing
  const queryBuilder: {
    where: {
      id: {
        [Op.in]: number[];
      };
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      createdAt?: {
        [Op.gte]?: Date;
        [Op.lte]?: Date;
      };
    };
    include: any[];
    limit?: number;
    offset?: number;
    order?: any[];
  } = {
    where: {
      id: { [Op.in]: orderIds }
    },
    include: [
      {
        model: OrderItem,
        as: "items",
        include: [{
          model: Product,
          as: "product",
          where: { supplierId },
          attributes: []
        }]
      },
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "username", "email", "firstName", "lastName", "phone"]
      }
    ]
  };

  // Filter by status with type checking
  if (req.query.status) {
    const status = req.query.status as string;
    if (Object.values(OrderStatus).includes(status as OrderStatus)) {
      queryBuilder.where.status = status as OrderStatus;
    } else {
      throw new AppError("Invalid order status", 400);
    }
  }

  // Filter by payment status with type checking
  if (req.query.paymentStatus) {
    const paymentStatus = req.query.paymentStatus as string;
    if (Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
      queryBuilder.where.paymentStatus = paymentStatus as PaymentStatus;
    } else {
      throw new AppError("Invalid payment status", 400);
    }
  }

  // Filter by date range with validation
  if (req.query.startDate) {
    const startDate = new Date(req.query.startDate as string);
    if (!isNaN(startDate.getTime())) {
      queryBuilder.where.createdAt = {
        ...queryBuilder.where.createdAt,
        [Op.gte]: startDate,
      };
    } else {
      throw new AppError("Invalid start date format", 400);
    }
  }

  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate as string);
    if (!isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      queryBuilder.where.createdAt = {
        ...queryBuilder.where.createdAt,
        [Op.lte]: endDate,
      };
    } else {
      throw new AppError("Invalid end date format", 400);
    }
  }

  // Pagination with validation
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  queryBuilder.limit = limit;
  queryBuilder.offset = offset;

  // Sorting with validation
  const sortField = req.query.sortBy as string || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
  queryBuilder.order = [[sortField, sortOrder]];

  // Execute query with proper error handling
  const { count, rows: orders } = await Order.findAndCountAll(queryBuilder);

  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    status: "success",
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