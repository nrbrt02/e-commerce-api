import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Op } from 'sequelize';
import models from '../models';

const { Review, Product, Customer, Order, OrderItem } = models;

/**
 * Get all reviews for a product
 * @route GET /api/products/:productId/reviews
 * @access Public
 */
export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  
  // Check if product exists
  const product = await Product.findByPk(productId);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Build query
  const queryBuilder: any = {
    where: {
      productId,
      isApproved: true,
    },
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      },
    ],
    order: [['createdAt', 'DESC']],
  };
  
  // Filter by rating
  if (req.query.rating) {
    queryBuilder.where.rating = parseInt(req.query.rating as string);
  }
  
  // Filter by verified purchases
  if (req.query.verified === 'true') {
    queryBuilder.where.isVerifiedPurchase = true;
  }
  
  // Include admin-only filters if user is admin
  if (req.user && await req.user.hasRole('admin')) {
    // Remove the isApproved filter for admins
    delete queryBuilder.where.isApproved;
    
    // Add specific approval status filter if provided
    if (req.query.approved) {
      queryBuilder.where.isApproved = req.query.approved === 'true';
    }
  }
  
  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  queryBuilder.limit = limit;
  queryBuilder.offset = offset;
  
  // Execute query
  const { count, rows: reviews } = await Review.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    pagination: {
      totalReviews: count,
      totalPages,
      currentPage: page,
      limit,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    data: {
      reviews,
    },
  });
});

/**
 * Get a single review
 * @route GET /api/reviews/:id
 * @access Public/Private
 */
export const getReviewById = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findByPk(req.params.id, {
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'slug', 'imageUrls'], // Changed from 'images' to 'imageUrls'
      },
    ],
  });

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  // Check if review is approved or user is admin/owner
  if (!review.isApproved) {
    if (!req.user) {
      throw new AppError('Review not found', 404);
    }

    const isAdmin = await req.user.hasRole('admin');
    const isOwner = 'id' in req.user && review.customerId === req.user.id;

    if (!isAdmin && !isOwner) {
      throw new AppError('Review not found', 404);
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

/**
 * Create a new review
 * @route POST /api/products/:productId/reviews
 * @access Private (Customer)
 */
export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { rating, title, comment, orderId } = req.body;
  
  // Check if product exists
  const product = await Product.findByPk(productId);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Check if customer has already reviewed this product
  const existingReview = await Review.findOne({
    where: {
      productId,
      customerId: req.user!.id,
    },
  });
  
  if (existingReview) {
    throw new AppError('You have already reviewed this product', 400);
  }
  
  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }
  
  // Check if this is a verified purchase
  let isVerifiedPurchase = false;
  let verifiedOrderId: number | undefined = undefined;
  
  if (orderId) {
    // Check specific order
    const order = await Order.findOne({
      where: {
        id: orderId,
        customerId: req.user!.id,
        status: {
          [Op.in]: ['delivered', 'completed'],
        },
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: { productId },
        },
      ],
    });
    
    if (order) {
      isVerifiedPurchase = true;
      verifiedOrderId = order.id;
    }
  } else {
    // Check if customer has purchased this product in any order
    const orders = await Order.findAll({
      where: {
        customerId: req.user!.id,
        status: {
          [Op.in]: ['delivered', 'completed'],
        },
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: { productId },
        },
      ],
    });
    
    if (orders.length > 0) {
      isVerifiedPurchase = true;
      verifiedOrderId = orders[0].id;
    }
  }
  
  // Create review
  const review = await Review.create({
    productId: parseInt(productId),
    customerId: req.user!.id,
    orderId: verifiedOrderId,
    rating,
    title,
    comment,
    isVerifiedPurchase,
    isApproved: false, // Default to not approved, admin will approve later
    helpfulVotes: 0,
  });
  
  // Get full review data
  const fullReview = await Review.findByPk(review.id, {
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      },
    ],
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      review: fullReview,
    },
  });
});

/**
 * Update a review
 * @route PUT /api/reviews/:id
 * @access Private (Customer, Admin)
 */
export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const { rating, title, comment } = req.body;
  
  // Find review
  const review = await Review.findByPk(req.params.id);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  // Check if user is the owner or admin
  const isAdmin = req.user && await req.user.hasRole('admin');
  const isOwner = req.user && review.customerId === req.user.id;
  
  if (!isAdmin && !isOwner) {
    throw new AppError('You do not have permission to update this review', 403);
  }
  
  // Update fields
  if (rating !== undefined) {
    if (rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }
    review.rating = rating;
  }
  
  if (title !== undefined) review.title = title;
  if (comment !== undefined) review.comment = comment;
  
  // Only admin can update approval status
  if (isAdmin && req.body.isApproved !== undefined) {
    review.isApproved = req.body.isApproved;
  }
  
  await review.save();
  
  // Get full review data
  const fullReview = await Review.findByPk(review.id, {
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      },
    ],
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      review: fullReview,
    },
  });
});

/**
 * Delete a review
 * @route DELETE /api/reviews/:id
 * @access Private (Customer, Admin)
 */
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findByPk(req.params.id);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  // Check if user is the owner or admin
  const isAdmin = req.user && await req.user.hasRole('admin');
  const isOwner = req.user && review.customerId === req.user.id;
  
  if (!isAdmin && !isOwner) {
    throw new AppError('You do not have permission to delete this review', 403);
  }
  
  await review.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

/**
 * Vote a review as helpful
 * @route POST /api/reviews/:id/vote
 * @access Private (Customer)
 */
export const voteReviewHelpful = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findByPk(req.params.id);
  
  if (!review) {
    throw new AppError('Review not found', 404);
  }
  
  // Increment helpful votes
  review.helpfulVotes += 1;
  await review.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      helpfulVotes: review.helpfulVotes,
    },
  });
});

/**
 * Get reviews by customer
 * @route GET /api/customers/reviews
 * @access Private (Customer)
 */
export const getCustomerReviews = asyncHandler(async (req: Request, res: Response) => {
  // Build query
  const queryBuilder: any = {
    where: {
      customerId: req.user!.id,
    },
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'slug', 'imageUrls'], // Changed from 'images' to 'imageUrls'
      },
    ],
    order: [['createdAt', 'DESC']],
  };
  
  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  queryBuilder.limit = limit;
  queryBuilder.offset = offset;
  
  // Execute query
  const { count, rows: reviews } = await Review.findAndCountAll(queryBuilder);
  
  // Calculate pagination info
  const totalPages = Math.ceil(count / limit);
  
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    pagination: {
      totalReviews: count,
      totalPages,
      currentPage: page,
      limit,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    data: {
      reviews,
    },
  });
});