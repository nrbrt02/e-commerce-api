import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import models from '../models';

const { Wishlist, Product, Customer } = models;
const { sequelize } = models;

/**
 * Get all wishlists for the authenticated customer
 * @route GET /api/wishlists
 * @access Private (Customer)
 */
export const getCustomerWishlists = asyncHandler(async (req: Request, res: Response) => {
  const wishlists = await Wishlist.findAll({
    where: {
      customerId: req.user!.id,
    },
    include: [
      {
        model: Product,
        as: 'products',
        through: { attributes: ['id', 'notes'] },
        attributes: ['id', 'name', 'slug', 'price', 'imageUrls'], // Changed from 'images' to 'imageUrls'
      },
    ],
  });
  
  res.status(200).json({
    status: 'success',
    results: wishlists.length,
    data: {
      wishlists,
    },
  });
});

/**
 * Get a single wishlist
 * @route GET /api/wishlists/:id
 * @access Private (Customer) or Public (if wishlist is public)
 */
export const getWishlistById = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await Wishlist.findByPk(req.params.id, {
    include: [
      {
        model: Product,
        as: 'products',
        through: { attributes: ['id', 'notes'] },
        attributes: ['id', 'name', 'slug', 'price', 'imageUrls'], // Changed from 'images' to 'imageUrls'
      },
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      },
    ],
  });

  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }

  // Check if wishlist is public or belongs to authenticated customer
  if (!wishlist.isPublic && (!req.user || wishlist.customerId !== req.user.id)) {
    throw new AppError('Wishlist not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      wishlist,
    },
  });
});

/**
 * Create a new wishlist
 * @route POST /api/wishlists
 * @access Private (Customer)
 */
export const createWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, isPublic } = req.body;
  
  // Validate name
  if (!name) {
    throw new AppError('Wishlist name is required', 400);
  }
  
  // Create wishlist
  const wishlist = await Wishlist.create({
    customerId: req.user!.id,
    name,
    description,
    isPublic: isPublic !== undefined ? isPublic : false,
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      wishlist,
    },
  });
});

/**
 * Update a wishlist
 * @route PUT /api/wishlists/:id
 * @access Private (Customer)
 */
export const updateWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, isPublic } = req.body;
  
  // Find wishlist
  const wishlist = await Wishlist.findByPk(req.params.id);
  
  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }
  
  // Check if wishlist belongs to authenticated customer
  if (wishlist.customerId !== req.user!.id) {
    throw new AppError('You do not have permission to update this wishlist', 403);
  }
  
  // Update wishlist
  if (name) wishlist.name = name;
  if (description !== undefined) wishlist.description = description;
  if (isPublic !== undefined) wishlist.isPublic = isPublic;
  
  await wishlist.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      wishlist,
    },
  });
});

/**
 * Delete a wishlist
 * @route DELETE /api/wishlists/:id
 * @access Private (Customer)
 */
export const deleteWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await Wishlist.findByPk(req.params.id);
  
  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }
  
  // Check if wishlist belongs to authenticated customer
  if (wishlist.customerId !== req.user!.id) {
    throw new AppError('You do not have permission to delete this wishlist', 403);
  }
  
  await wishlist.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

/**
 * Add product to wishlist
 * @route POST /api/wishlists/:id/items
 * @access Private (Customer)
 */
export const addProductToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId, notes } = req.body;
  
  // Validate product ID
  if (!productId) {
    throw new AppError('Product ID is required', 400);
  }
  
  // Check if product exists
  const product = await Product.findByPk(productId);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  // Check if wishlist exists and belongs to authenticated customer
  const wishlist = await Wishlist.findOne({
    where: {
      id: req.params.id,
      customerId: req.user!.id,
    },
  });
  
  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }
  
  // Check if product already in wishlist
  const existingItem = await sequelize.models.WishlistItem.findOne({
    where: {
      wishlistId: wishlist.id,
      productId,
    },
  });
  
  if (existingItem) {
    throw new AppError('Product already in wishlist', 400);
  }
  
  // Add product to wishlist
  const wishlistItem = await sequelize.models.WishlistItem.create({
    wishlistId: wishlist.id,
    productId,
    notes,
  });
  
  // Get the product details to return
  const itemWithProduct = await sequelize.models.WishlistItem.findByPk(wishlistItem.id, {
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'slug', 'price', 'imageUrls'], // Changed from 'images' to 'imageUrls'
      },
    ],
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      item: itemWithProduct,
    },
  });
});

/**
 * Remove product from wishlist
 * @route DELETE /api/wishlists/:id/items/:itemId
 * @access Private (Customer)
 */
export const removeProductFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  
  // Check if wishlist exists and belongs to authenticated customer
  const wishlist = await Wishlist.findOne({
    where: {
      id,
      customerId: req.user!.id,
    },
  });
  
  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }
  
  // Find wishlist item
  const wishlistItem = await sequelize.models.WishlistItem.findOne({
    where: {
      id: itemId,
      wishlistId: wishlist.id,
    },
  });
  
  if (!wishlistItem) {
    throw new AppError('Item not found in wishlist', 404);
  }
  
  // Remove item from wishlist
  await wishlistItem.destroy();
  
  res.status(200).json({
    status: 'success',
    data: null,
  });
});

/**
 * Move product to another wishlist
 * @route POST /api/wishlists/:id/items/:itemId/move
 * @access Private (Customer)
 */
export const moveProductToAnotherWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const { targetWishlistId } = req.body;
  
  if (!targetWishlistId) {
    throw new AppError('Target wishlist ID is required', 400);
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    // Check if source wishlist exists and belongs to authenticated customer
    const sourceWishlist = await Wishlist.findOne({
      where: {
        id,
        customerId: req.user!.id,
      },
      transaction,
    });
    
    if (!sourceWishlist) {
      throw new AppError('Source wishlist not found', 404);
    }
    
    // Check if target wishlist exists and belongs to authenticated customer
    const targetWishlist = await Wishlist.findOne({
      where: {
        id: targetWishlistId,
        customerId: req.user!.id,
      },
      transaction,
    });
    
    if (!targetWishlist) {
      throw new AppError('Target wishlist not found', 404);
    }
    
    // Find wishlist item
    const wishlistItem = await sequelize.models.WishlistItem.findOne({
      where: {
        id: itemId,
        wishlistId: sourceWishlist.id,
      },
      transaction,
    });
    
    if (!wishlistItem) {
      throw new AppError('Item not found in wishlist', 404);
    }
    
    // Check if product already exists in target wishlist
    const existingItemInTarget = await sequelize.models.WishlistItem.findOne({
      where: {
        wishlistId: targetWishlist.id,
        productId: wishlistItem.productId,
      },
      transaction,
    });
    
    if (existingItemInTarget) {
      throw new AppError('Product already exists in target wishlist', 400);
    }
    
    // Move item to target wishlist
    wishlistItem.wishlistId = targetWishlist.id;
    await wishlistItem.save({ transaction });
    
    await transaction.commit();
    
    res.status(200).json({
      status: 'success',
      data: {
        item: wishlistItem,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Update wishlist item notes
 * @route PUT /api/wishlists/:id/items/:itemId
 * @access Private (Customer)
 */
export const updateWishlistItemNotes = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const { notes } = req.body;
  
  // Check if wishlist exists and belongs to authenticated customer
  const wishlist = await Wishlist.findOne({
    where: {
      id,
      customerId: req.user!.id,
    },
  });
  
  if (!wishlist) {
    throw new AppError('Wishlist not found', 404);
  }
  
  // Find wishlist item
  const wishlistItem = await sequelize.models.WishlistItem.findOne({
    where: {
      id: itemId,
      wishlistId: wishlist.id,
    },
  });
  
  if (!wishlistItem) {
    throw new AppError('Item not found in wishlist', 404);
  }
  
  // Update notes
  wishlistItem.notes = notes;
  await wishlistItem.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      item: wishlistItem,
    },
  });
});