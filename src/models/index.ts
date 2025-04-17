// src/models/index.ts
import { Sequelize } from 'sequelize';
import sequelize from '../config/db';
import { logger } from '../utils/logger';

// Import model definitions
import defineAddressModel, { Address } from './Address';
import defineCategoryModel, { Category } from './Category'; 
import defineCustomerModel, { Customer } from './Customer';
import defineOrderModel, { Order } from './Order';
import defineOrderItemModel, { OrderItem } from './OrderItem';
import defineProductModel, { Product } from './Product';
import defineProductImageModel, { ProductImage } from './ProductImage';
import defineReviewModel, { Review } from './Review';
import defineRoleModel, { Role } from './Role';
import defineUserModel, { User } from './User';
import defineWishlistModel, { Wishlist } from './Wishlist';

import config from '../config/db';


// Create models object
const models: Record<string, any> = {};

try {
  // Initialize all models
  models.Address = defineAddressModel(sequelize);
  models.Category = defineCategoryModel(sequelize);
  models.Customer = defineCustomerModel(sequelize);
  models.Product = defineProductModel(sequelize);
  models.ProductImage = defineProductImageModel(sequelize);
  models.Review = defineReviewModel(sequelize);
  models.Role = defineRoleModel(sequelize);
  models.User = defineUserModel(sequelize);
  models.Order = defineOrderModel(sequelize);
  models.OrderItem = defineOrderItemModel(sequelize);
  models.Wishlist = defineWishlistModel(sequelize);



  // Create junction tables for many-to-many relationships
  const UserRole = sequelize.define('UserRole', {}, { timestamps: false });
  const ProductCategory = sequelize.define('ProductCategory', {}, { timestamps: false });
  const WishlistItem = sequelize.define('WishlistItem', {}, { timestamps: false });

  // Setup associations
  // Address associations
  models.Address.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Address, { foreignKey: 'customerId', as: 'customerAddresses' });

  // Category associations
  models.Category.belongsTo(models.Category, { foreignKey: 'parentId', as: 'parent' });
  models.Category.hasMany(models.Category, { foreignKey: 'parentId', as: 'subcategories' });

  // Product associations
  models.Product.belongsTo(models.User, { as: 'supplier', foreignKey: 'supplierId' });
  models.Product.belongsToMany(models.Category, { through: ProductCategory, as: 'categories' });
  models.Category.belongsToMany(models.Product, { through: ProductCategory, as: 'products' });

  // ProductImage associations
  models.ProductImage.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  models.Product.hasMany(models.ProductImage, { foreignKey: 'productId', as: 'productImages' }); // Using 'productImages' to avoid collision with 'imageUrls' attribute

  // Review associations
  models.Review.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  models.Product.hasMany(models.Review, { foreignKey: 'productId', as: 'reviews' });
  models.Review.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Review, { foreignKey: 'customerId', as: 'reviews' });

  // Order associations
  models.Order.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Order, { foreignKey: 'customerId', as: 'orders' });
  models.Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
  models.OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
  models.OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });

  // User-Role associations
  models.User.belongsToMany(models.Role, { through: UserRole, as: 'roles' });
  models.Role.belongsToMany(models.User, { through: UserRole, as: 'users' });

  // Wishlist associations
  models.Wishlist.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Wishlist, { foreignKey: 'customerId', as: 'wishlists' });
  models.Wishlist.belongsToMany(models.Product, { through: WishlistItem, as: 'products' });
  models.Product.belongsToMany(models.Wishlist, { through: WishlistItem, as: 'wishlists' });

  // Helper functions for model hooks
  // Implement the updateProductRating function for the Review hooks
  const updateProductRating = async (productId: number): Promise<void> => {
    try {
      // Get all approved reviews for this product
      const reviews = await models.Review.findAll({
        where: {
          productId,
          isApproved: true,
        },
        attributes: ['rating'],
      });

      // Calculate average rating
      let avgRating = 0;
      if (reviews.length > 0) {
        // Fix for: Parameter 'total' implicitly has an 'any' type
        // Fix for: Parameter 'review' implicitly has an 'any' type
        const sum = reviews.reduce((total: number, review: { rating: number }) => total + review.rating, 0);
        avgRating = sum / reviews.length;
      }

      // Update product with new rating
      await models.Product.update(
        {
          metadata: {
            ...((await models.Product.findByPk(productId))?.get('metadata') || {}),
            rating: {
              average: avgRating,
              count: reviews.length,
            },
          },
        },
        {
          where: { id: productId },
        }
      );
    } catch (error) {
      logger.error(`Error updating product rating: ${error}`);
    }
  };

  // Implement updateOrderTotals for OrderItem hooks
  const updateOrderTotals = async (orderId: number): Promise<void> => {
    try {
      // Get all items for this order
      const items = await models.OrderItem.findAll({
        where: { orderId },
      });

      // Calculate totals
      const totalItems = items.length;
      // Fix for: Parameter 'sum' implicitly has an 'any' type
      // Fix for: Parameter 'item' implicitly has an 'any' type
      const totalAmount = items.reduce((sum: number, item: { total: number }) => sum + Number(item.total), 0);

      // Update order with new totals
      await models.Order.update(
        {
          totalItems,
          totalAmount,
        },
        {
          where: { id: orderId },
        }
      );
    } catch (error) {
      logger.error(`Error updating order totals: ${error}`);
    }
  };

  // Add hook implementations for Review model
  models.Review.addHook('afterCreate', async (review: Review) => {
    await updateProductRating(review.productId);
  });

  models.Review.addHook('afterUpdate', async (review: Review) => {
    if (review.changed('rating') || review.changed('isApproved')) {
      await updateProductRating(review.productId);
    }
  });

  models.Review.addHook('afterDestroy', async (review: Review) => {
    await updateProductRating(review.productId);
  });

  // Add hook implementations for OrderItem model
  models.OrderItem.addHook('afterCreate', async (item: OrderItem) => {
    await updateOrderTotals(item.orderId);
  });

  models.OrderItem.addHook('afterUpdate', async (item: OrderItem) => {
    await updateOrderTotals(item.orderId);
  });

  models.OrderItem.addHook('afterDestroy', async (item: OrderItem) => {
    await updateOrderTotals(item.orderId);
  });

} catch (error) {
  logger.error(`Error setting up models and associations: ${error}`);
  throw error;
}

export { sequelize };
export default models;