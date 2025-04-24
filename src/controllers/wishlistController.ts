import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import models from "../models";
import { WishlistItem as WishlistItemType } from "../models/WishlistItem";

const { Wishlist, Product, Customer, WishlistItem } = models;
const { sequelize } = models;

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

/**
 * Get all wishlists for the authenticated customer
 * @route GET /api/wishlists
 * @access Private (Customer)
 */
export const getCustomerWishlists = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get all wishlists for the authenticated customer
      const wishlists = await Wishlist.findAll({
        where: {
          customerId: req.user!.id,
        },
      });

      // For each wishlist, get the items and products separately
      const wishlistsWithItems = await Promise.all(
        wishlists.map(async (wishlist: typeof Wishlist.prototype) => {
          // Get wishlist items with products
          const items = await WishlistItem.findAll({
            where: { wishlistId: wishlist.id },
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name", "price", "imageUrls"],
              },
            ],
          });

          // Return wishlist with items
          return {
            ...wishlist.get({ plain: true }),
            items: items.map((item: WishlistItemType) =>
              item.get({ plain: true })
            ),
          };
        })
      );

      res.status(200).json({
        status: "success",
        results: wishlistsWithItems.length,
        data: {
          wishlists: wishlistsWithItems,
        },
      });
    } catch (error) {
      console.error("Error fetching customer wishlists:", error);
      throw error;
    }
  }
);

/**
 * Get a single wishlist (for debugging)
 * @route GET /api/wishlists/:id/debug
 * @access Private (for debugging only)
 */
export const getWishlistByIdDebug = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Step 1: Try to find the wishlist without any includes first
      const simpleWishlist = await Wishlist.findByPk(req.params.id);
      console.log(
        "Simple wishlist query result:",
        simpleWishlist ? "Found" : "Not found"
      );

      if (simpleWishlist) {
        console.log("Wishlist data:", {
          id: simpleWishlist.id,
          name: simpleWishlist.name,
          customerId: simpleWishlist.customerId,
          isPublic: simpleWishlist.isPublic,
        });
      }

      // Step 2: Try to find the customer if the wishlist exists
      let customer = null;
      if (simpleWishlist) {
        customer = await Customer.findByPk(simpleWishlist.customerId);
        console.log("Customer query result:", customer ? "Found" : "Not found");
      }

      // Step 3: Try to find associated items and products
      let items: WishlistItemType[] = [];
      let products: any[] = [];

      if (simpleWishlist) {
        try {
          // Get associated items with products
          items = await WishlistItem.findAll({
            where: { wishlistId: simpleWishlist.id },
            include: [
              {
                model: Product,
                as: "product",
                attributes: ["id", "name", "price", "imageUrls"],
              },
            ],
          });

          // Extract products from items for convenience
          products = items.map((item: WishlistItemType) => item.get("product"));
          console.log(
            "Products query result:",
            products.length > 0
              ? `Found ${products.length} products`
              : "No products found"
          );
        } catch (error) {
          console.error("Error getting products:", error);
        }
      }

      // Return all the data we found
      res.status(200).json({
        status: "success",
        debug: true,
        data: {
          wishlistExists: !!simpleWishlist,
          wishlistData: simpleWishlist
            ? simpleWishlist.get({ plain: true })
            : null,
          customerExists: !!customer,
          customerData: customer ? customer.get({ plain: true }) : null,
          itemsCount: items.length,
          items: items.map((item: WishlistItemType) =>
            item.get({ plain: true })
          ),
          productsCount: products.length,
          products: products,
          userAuthenticated: !!req.user,
          userInfo: req.user
            ? {
                id: req.user.id,
                isCustomerMatch: simpleWishlist
                  ? req.user.id === simpleWishlist.customerId
                  : false,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error in debug function:", error);
      throw error;
    }
  }
);

/**
 * Get a single wishlist with details
 * @route GET /api/wishlists/:id
 * @access Private (Customer) or Public (if wishlist is public)
 */
export const getWishlistById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log(`Getting wishlist with ID: ${req.params.id}`);
  console.log(`User authenticated: ${!!req.user}`);
  if (req.user) {
    console.log(`User ID: ${req.user.id}`);
  }
  
  try {
    // First try a simple query to see if the wishlist exists at all
    const simpleWishlist = await Wishlist.findByPk(req.params.id);
    console.log('Simple wishlist query result:', simpleWishlist ? 'Found' : 'Not found');
    
    if (simpleWishlist) {
      console.log('Wishlist data:', {
        id: simpleWishlist.id,
        name: simpleWishlist.name,
        customerId: simpleWishlist.customerId,
        isPublic: simpleWishlist.isPublic
      });
    } else {
      throw new AppError('Wishlist not found', 404);
    }
    
    // Check if wishlist is public or belongs to authenticated customer
    const isOwner = req.user && req.user.id === parseInt(simpleWishlist.customerId);
    console.log('Is owner check:', isOwner, 'User ID:', req.user?.id, 'Wishlist customerId:', simpleWishlist.customerId);
    
    if (!simpleWishlist.isPublic && !isOwner) {
      console.log('Access denied: Wishlist is private and does not belong to the user');
      throw new AppError('Wishlist not found', 404);
    }
    
    // If we got here, then the wishlist exists and the user has permission to view it
    try {
      // Find all wishlist items with product data
      const items = await WishlistItem.findAll({
        where: { wishlistId: simpleWishlist.id },
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'price', 'imageUrls'],
          }
        ]
      });
      
      // Get customer info
      const customer = await Customer.findByPk(simpleWishlist.customerId, {
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      });
      
      // Prepare full response
      const wishlistData = {
        ...simpleWishlist.get({ plain: true }),
        items: items.map((item: WishlistItemType) => item.get({ plain: true })),
        customer: customer ? customer.get({ plain: true }) : null
      };
      
      console.log('Successfully retrieved wishlist data with related items');
      
      res.status(200).json({
        status: 'success',
        data: {
          wishlist: wishlistData,
        },
      });
    } catch (error) {
      console.error('Error in include query:', error);
      
      // Fall back to returning just the simple wishlist data
      res.status(200).json({
        status: 'success',
        message: 'Returning partial data due to association error',
        data: {
          wishlist: simpleWishlist,
        },
      });
    }
  } catch (error) {
    console.error('Error in getWishlistById:', error);
    throw error;
  }
});

/**
 * Create a new wishlist
 * @route POST /api/wishlists
 * @access Private (Customer)
 */
export const createWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, isPublic } = req.body;

    // Validate name
    if (!name) {
      throw new AppError("Wishlist name is required", 400);
    }

    try {
      // Create wishlist
      const wishlist = await Wishlist.create({
        customerId: req.user!.id,
        name,
        description,
        isPublic: isPublic !== undefined ? isPublic : false,
      });

      res.status(201).json({
        status: "success",
        data: {
          wishlist: wishlist.get({ plain: true }),
        },
      });
    } catch (error) {
      console.error("Error creating wishlist:", error);
      throw error;
    }
  }
);

/**
 * Update a wishlist
 * @route PUT /api/wishlists/:id
 * @access Private (Customer)
 */
export const updateWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, isPublic } = req.body;

    try {
      // Find wishlist
      const wishlist = await Wishlist.findByPk(req.params.id);

      if (!wishlist) {
        throw new AppError("Wishlist not found", 404);
      }

      // Check if wishlist belongs to authenticated customer
      if (wishlist.customerId !== req.user!.id) {
        throw new AppError(
          "You do not have permission to update this wishlist",
          403
        );
      }

      // Update wishlist
      if (name) wishlist.name = name;
      if (description !== undefined) wishlist.description = description;
      if (isPublic !== undefined) wishlist.isPublic = isPublic;

      await wishlist.save();

      // Get items for the wishlist
      const items = await WishlistItem.findAll({
        where: { wishlistId: wishlist.id },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
      });

      // Return updated wishlist with items
      const updatedWishlistData = {
        ...wishlist.get({ plain: true }),
        items: items.map((item: WishlistItemType) => item.get({ plain: true })),
      };

      res.status(200).json({
        status: "success",
        data: {
          wishlist: updatedWishlistData,
        },
      });
    } catch (error) {
      console.error("Error updating wishlist:", error);
      throw error;
    }
  }
);

/**
 * Delete a wishlist
 * @route DELETE /api/wishlists/:id
 * @access Private (Customer)
 */
export const deleteWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const wishlist = await Wishlist.findByPk(req.params.id);

      if (!wishlist) {
        throw new AppError("Wishlist not found", 404);
      }

      // Check if wishlist belongs to authenticated customer
      if (wishlist.customerId !== req.user!.id) {
        throw new AppError(
          "You do not have permission to delete this wishlist",
          403
        );
      }

      await wishlist.destroy();

      res.status(200).json({
        status: "success",
        data: null,
      });
    } catch (error) {
      console.error("Error deleting wishlist:", error);
      throw error;
    }
  }
);

/**
 * Add product to wishlist
 * @route POST /api/wishlists/:id/items
 * @access Private (Customer)
 */
/**
 * Add product to wishlist
 * @route POST /api/wishlists/:id/items
 * @access Private (Customer)
 */
/**
 * Add product to wishlist
 * @route POST /api/wishlists/:id/items
 * @access Private (Customer)
 */

/**
 * Get the default wishlist for the authenticated customer
 * @route GET /api/wishlists/default
 * @access Private (Customer)
 */
export const getDefaultWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get the customer with their default wishlist
      const customer = await Customer.findByPk(req.user!.id);
      
      if (!customer) {
        throw new AppError("Customer not found", 404);
      }
      
      let wishlist;
      
      // Check if customer has a default wishlist
      if (customer.defaultWishlistId) {
        wishlist = await Wishlist.findByPk(customer.defaultWishlistId);
      }
      
      // If no default wishlist found, get the first wishlist or create one
      if (!wishlist) {
        // Try to find any wishlist for the customer
        wishlist = await Wishlist.findOne({
          where: { customerId: req.user!.id }
        });
        
        // If still no wishlist, create a default one
        if (!wishlist) {
          let wishlistName = "My Wishlist";
          if (customer.firstName && customer.lastName) {
            wishlistName = `${customer.firstName} ${customer.lastName}'s Wishlist`;
          } else if (customer.firstName) {
            wishlistName = `${customer.firstName}'s Wishlist`;
          } else if (customer.username) {
            wishlistName = `${customer.username}'s Wishlist`;
          }
          
          wishlist = await Wishlist.create({
            customerId: req.user!.id,
            name: wishlistName,
            description: "Default wishlist",
            isPublic: false,
          });
          
          // Update the customer with the new default wishlist ID
          await customer.update({ defaultWishlistId: wishlist.id });
        } else {
          // Update the customer with this wishlist as default
          await customer.update({ defaultWishlistId: wishlist.id });
        }
      }
      
      // Get items for the wishlist
      const items = await WishlistItem.findAll({
        where: { wishlistId: wishlist.id },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
      });
      
      // Return the default wishlist with items
      const wishlistData = {
        ...wishlist.get({ plain: true }),
        items: items.map((item: WishlistItemType) => item.get({ plain: true })),
        isDefault: true
      };
      
      res.status(200).json({
        status: "success",
        data: {
          wishlist: wishlistData,
        },
      });
    } catch (error) {
      console.error("Error fetching default wishlist:", error);
      throw error;
    }
  }
);

/**
 * Set a wishlist as the default for the authenticated customer
 * @route POST /api/wishlists/:id/set-default
 * @access Private (Customer)
 */
export const setDefaultWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Find the wishlist
      const wishlist = await Wishlist.findOne({
        where: {
          id: req.params.id,
          customerId: req.user!.id,
        },
      });
      
      if (!wishlist) {
        throw new AppError("Wishlist not found", 404);
      }
      
      // Update the customer's default wishlist ID
      await Customer.update(
        { defaultWishlistId: wishlist.id },
        { where: { id: req.user!.id } }
      );
      
      res.status(200).json({
        status: "success",
        data: {
          wishlist: {
            id: wishlist.id,
            name: wishlist.name,
            isDefault: true
          },
        },
      });
    } catch (error) {
      console.error("Error setting default wishlist:", error);
      throw error;
    }
  }
);


/**
 * Add product to wishlist
 * @route POST /api/wishlists/:id/items
 * @access Private (Customer)
 */
export const addProductToWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { productId, notes } = req.body;
    let wishlist;
    let isNewlyCreated = false;

    // Validate product ID
    if (!productId) {
      throw new AppError("Product ID is required", 400);
    }

    try {
      // Check if product exists
      const product = await Product.findByPk(productId);

      if (!product) {
        throw new AppError("Product not found", 404);
      }

      // First, check if a specific wishlist ID was provided and it belongs to the user
      if (req.params.id !== 'default') {
        wishlist = await Wishlist.findOne({
          where: {
            id: req.params.id,
            customerId: req.user!.id,
          },
        });
      }

      // If no specific wishlist was found, get the customer's default wishlist
      if (!wishlist) {
        const customer = await Customer.findByPk(req.user!.id);
        
        if (customer && customer.defaultWishlistId) {
          wishlist = await Wishlist.findByPk(customer.defaultWishlistId);
        }
      }

      // If still no wishlist, create a new one for the user
      if (!wishlist) {
        // Get customer info for wishlist name
        const customer = await Customer.findByPk(req.user!.id, {
          attributes: ['firstName', 'lastName', 'email', 'username'],
        });
        
        // Create wishlist name based on customer info
        let wishlistName = "My Wishlist";
        if (customer) {
          if (customer.firstName && customer.lastName) {
            wishlistName = `${customer.firstName} ${customer.lastName}'s Wishlist`;
          } else if (customer.firstName) {
            wishlistName = `${customer.firstName}'s Wishlist`;
          } else if (customer.username) {
            wishlistName = `${customer.username}'s Wishlist`;
          } else if (customer.email) {
            wishlistName = `${customer.email}'s Wishlist`;
          }
        }
        
        // Create new wishlist
        wishlist = await Wishlist.create({
          name: wishlistName,
          customerId: req.user!.id,
          description: "Automatically created wishlist"
        });
        
        // Update customer's default wishlist reference
        await Customer.update(
          { defaultWishlistId: wishlist.id },
          { where: { id: req.user!.id } }
        );
        
        isNewlyCreated = true;
        console.log(`Created new wishlist for user: ${req.user!.id}`);
      }

      // Check if product already in wishlist
      const existingItem = await WishlistItem.findOne({
        where: {
          wishlistId: wishlist.id,
          productId,
        },
      });

      if (existingItem) {
        throw new AppError("Product already in wishlist", 400);
      }

      // Add product to wishlist
      const wishlistItem = await WishlistItem.create({
        wishlistId: wishlist.id,
        productId,
        notes,
      });

      // Get the complete item with product details
      const createdItem = await WishlistItem.findByPk(wishlistItem.id, {
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
      });

      if (!createdItem) {
        throw new AppError("Error retrieving created item", 500);
      }

      // Return a clean response with plain object
      res.status(201).json({
        status: "success",
        data: {
          item: createdItem.get({ plain: true }),
          wishlist: {
            id: wishlist.id,
            name: wishlist.name,
            isNewlyCreated: isNewlyCreated
          }
        },
      });
    } catch (error) {
      console.error("Error adding product to wishlist:", error);
      throw error;
    }
  }
);

/**
 * Remove product from wishlist
 * @route DELETE /api/wishlists/:id/items/:itemId
 * @access Private (Customer)
 */
export const removeProductFromWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id, itemId } = req.params;

    try {
      // Check if wishlist exists and belongs to authenticated customer
      const wishlist = await Wishlist.findOne({
        where: {
          id,
          customerId: req.user!.id,
        },
      });

      if (!wishlist) {
        throw new AppError("Wishlist not found", 404);
      }

      // Find wishlist item
      const wishlistItem = await WishlistItem.findOne({
        where: {
          id: itemId,
          wishlistId: wishlist.id,
        },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
      });

      if (!wishlistItem) {
        throw new AppError("Item not found in wishlist", 404);
      }

      // Store the item data before deleting for response
      const removedItem = wishlistItem.get({ plain: true });

      // Remove item from wishlist
      await wishlistItem.destroy();

      res.status(200).json({
        status: "success",
        data: {
          removedItem: removedItem,
        },
      });
    } catch (error) {
      console.error("Error removing product from wishlist:", error);
      throw error;
    }
  }
);

/**
 * Move product to another wishlist
 * @route POST /api/wishlists/:id/items/:itemId/move
 * @access Private (Customer)
 */
export const moveProductToAnotherWishlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id, itemId } = req.params;
    const { targetWishlistId } = req.body;

    if (!targetWishlistId) {
      throw new AppError("Target wishlist ID is required", 400);
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
        throw new AppError("Source wishlist not found", 404);
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
        throw new AppError("Target wishlist not found", 404);
      }

      // Find wishlist item
      const wishlistItem = await WishlistItem.findOne({
        where: {
          id: itemId,
          wishlistId: sourceWishlist.id,
        },
        transaction,
      });

      if (!wishlistItem) {
        throw new AppError("Item not found in wishlist", 404);
      }

      // Check if product already exists in target wishlist
      const existingItemInTarget = await WishlistItem.findOne({
        where: {
          wishlistId: targetWishlist.id,
          productId: wishlistItem.productId,
        },
        transaction,
      });

      if (existingItemInTarget) {
        throw new AppError("Product already exists in target wishlist", 400);
      }

      // Move item to target wishlist
      wishlistItem.wishlistId = targetWishlist.id;
      await wishlistItem.save({ transaction });

      // Fetch the complete updated item with product details
      const updatedItem = await WishlistItem.findByPk(wishlistItem.id, {
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
        transaction,
      });

      await transaction.commit();

      res.status(200).json({
        status: "success",
        data: {
          item:
            updatedItem?.get({ plain: true }) ||
            wishlistItem.get({ plain: true }),
          sourceWishlistId: sourceWishlist.id,
          targetWishlistId: targetWishlist.id,
        },
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Error moving product between wishlists:", error);
      throw error;
    }
  }
);

/**
 * Update wishlist item notes
 * @route PUT /api/wishlists/:id/items/:itemId
 * @access Private (Customer)
 */
export const updateWishlistItemNotes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id, itemId } = req.params;
    const { notes } = req.body;

    try {
      // Check if wishlist exists and belongs to authenticated customer
      const wishlist = await Wishlist.findOne({
        where: {
          id,
          customerId: req.user!.id,
        },
      });

      if (!wishlist) {
        throw new AppError("Wishlist not found", 404);
      }

      // Find wishlist item
      const wishlistItem = await WishlistItem.findOne({
        where: {
          id: itemId,
          wishlistId: wishlist.id,
        },
      });

      if (!wishlistItem) {
        throw new AppError("Item not found in wishlist", 404);
      }

      // Update notes
      wishlistItem.notes = notes;
      await wishlistItem.save();

      // Get the updated item with product information
      const updatedItem = await WishlistItem.findByPk(itemId, {
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "imageUrls"],
          },
        ],
      });

      if (!updatedItem) {
        throw new AppError("Error retrieving updated item", 500);
      }

      res.status(200).json({
        status: "success",
        data: {
          item: updatedItem.get({ plain: true }),
        },
      });
    } catch (error) {
      console.error("Error updating wishlist item notes:", error);
      throw error;
    }
  }
);
