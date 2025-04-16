// src/models/associations.ts
// This file should be imported after all models are defined
// It sets up all relationships between models to avoid circular dependencies

import Product from './Product';
import Category from './Category';
import ProductImage from './ProductImage';
import Customer from './Customer';
import Address from './Address';

// Define all associations in one place
const setupAssociations = () => {
  // Create junction table for Product-Category many-to-many relationship
  const ProductCategory = Product.sequelize?.define('ProductCategory', {}, { timestamps: false });
  
  // Product - Category (many-to-many)
  Product.belongsToMany(Category, { through: 'ProductCategory', as: 'productCategories' });
  Category.belongsToMany(Product, { through: 'ProductCategory', as: 'categoryProducts' });
  
  // Product - ProductImage (one-to-many)
  Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images' });
  ProductImage.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
  
  // Customer - Address (one-to-many) 
  // This association is already defined in your model files, so we'll comment it out
  // Customer.hasMany(Address, { foreignKey: 'customerId', as: 'addressList' });
  // Address.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

  // Add other associations as needed
};

export default setupAssociations;