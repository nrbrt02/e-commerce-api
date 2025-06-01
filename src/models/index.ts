import { Sequelize, Op } from 'sequelize';
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
import defineWishlistItemModel, { WishlistItem } from './WishlistItem';
import defineSupplierModel, { Supplier } from './Supplier';



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
  models.WishlistItem = defineWishlistItemModel(sequelize);
  models.Supplier = defineSupplierModel(sequelize); // Added Supplier model initialization

  // Create junction tables for many-to-many relationships
  models.UserRole = sequelize.define('UserRole', {}, { tableName: 'UserRoles', timestamps: false });
  models.ProductCategory = sequelize.define('ProductCategory', {}, { timestamps: false });

  // Setup associations
  // Address associations
  models.Address.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Address, { foreignKey: 'customerId', as: 'customerAddresses' });

  // Category associations
  models.Category.belongsTo(models.Category, { foreignKey: 'parentId', as: 'parent' });
  models.Category.hasMany(models.Category, { foreignKey: 'parentId', as: 'subcategories' });

  // Product associations (updated to use Supplier instead of User)
  models.Product.belongsTo(models.Supplier, { as: 'supplier', foreignKey: 'supplierId' });
  models.Supplier.hasMany(models.Product, { foreignKey: 'supplierId', as: 'products' });
  
  // Product-Category associations
  models.Product.belongsToMany(models.Category, { through: models.ProductCategory, as: 'categories' });
  models.Category.belongsToMany(models.Product, { through: models.ProductCategory, as: 'products' });

  // ProductImage associations
  models.ProductImage.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  models.Product.hasMany(models.ProductImage, { foreignKey: 'productId', as: 'productImages' });

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

  // Supplier-Order associations (new)
  models.Order.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
  models.Supplier.hasMany(models.Order, { foreignKey: 'supplierId', as: 'orders' });

  // User-Role associations
  models.User.belongsToMany(models.Role, { through: models.UserRole, as: 'roles' });
  models.Role.belongsToMany(models.User, { through: models.UserRole, as: 'users' });

  // Wishlist associations
  models.Wishlist.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  models.Customer.hasMany(models.Wishlist, { foreignKey: 'customerId', as: 'wishlists' });
  
  // Wishlist-Product many-to-many relationship with explicit through model
  models.Wishlist.belongsToMany(models.Product, { 
    through: models.WishlistItem,
    foreignKey: 'wishlistId', 
    otherKey: 'productId',
    as: 'products' 
  });
  
  models.Product.belongsToMany(models.Wishlist, { 
    through: models.WishlistItem,
    foreignKey: 'productId', 
    otherKey: 'wishlistId',
    as: 'wishlists' 
  });
  
  // WishlistItem explicit associations
  models.WishlistItem.belongsTo(models.Wishlist, { foreignKey: 'wishlistId' });
  models.Wishlist.hasMany(models.WishlistItem, { foreignKey: 'wishlistId' });
  
  models.WishlistItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  models.Product.hasMany(models.WishlistItem, { foreignKey: 'productId' });

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

  // Add hook to update supplier rating based on reviews
  const updateSupplierRating = async (supplierId: number): Promise<void> => {
    try {
      // Get all products for this supplier
      const products = await models.Product.findAll({
        where: { supplierId },
        attributes: ['id']
      });
      
      const productIds = products.map((product: any) => product.id);
      
      if (productIds.length === 0) {
        return;
      }
      
      // Get approved reviews for all supplier's products
      const reviews = await models.Review.findAll({
        where: {
          productId: { [Op.in]: productIds }, // Use imported Op directly
          isApproved: true
        },
        attributes: ['rating']
      });
      
      // Calculate average rating
      let avgRating = 0;
      if (reviews.length > 0) {
        const sum = reviews.reduce((total: number, review: { rating: number }) => total + review.rating, 0);
        avgRating = sum / reviews.length;
      }
      
      // Update supplier rating
      await models.Supplier.update(
        { rating: avgRating },
        { where: { id: supplierId } }
      );
    } catch (error) {
      logger.error(`Error updating supplier rating: ${error}`);
    }
  };
  
  // Add hook for updating supplier rating when review is created/updated
  models.Review.addHook('afterCreate', async (review: Review) => {
    try {
      const product = await models.Product.findByPk(review.productId);
      if (product) {
        await updateSupplierRating((product as any).supplierId);
      }
    } catch (error) {
      logger.error(`Error triggering supplier rating update: ${error}`);
    }
  });
  
  models.Review.addHook('afterUpdate', async (review: Review) => {
    try {
      if (review.changed('rating') || review.changed('isApproved')) {
        const product = await models.Product.findByPk(review.productId);
        if (product) {
          await updateSupplierRating((product as any).supplierId);
        }
      }
    } catch (error) {
      logger.error(`Error triggering supplier rating update: ${error}`);
    }
  });

} catch (error) {
  logger.error(`Error setting up models and associations: ${error}`);
  throw error;
}

export { models, sequelize };
export default models;