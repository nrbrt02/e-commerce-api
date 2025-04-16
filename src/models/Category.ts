import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import { Op } from 'sequelize';

// Category attributes interface
export interface CategoryAttributes {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: number;
  level: number;
  path: string;
  isActive: boolean;
  order: number;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface CategoryCreationAttributes extends Optional<CategoryAttributes, 
  'id' | 'description' | 'image' | 'parentId' | 'level' | 'path' | 'isActive' | 'order' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Category model class
class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  public id!: number;
  public name!: string;
  public slug!: string;
  public description?: string;
  public image?: string;
  public parentId?: number;
  public level!: number;
  public path!: string;
  public isActive!: boolean;
  public order!: number;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper method to get all subcategories
  public async getSubcategories(includeInactive = false): Promise<Category[]> {
    const query: any = {
      where: {
        path: {
          [Op.like]: `${this.path}%`,
        },
        id: {
          [Op.ne]: this.id,
        }
      }
    };

    if (!includeInactive) {
      query.where.isActive = true;
    }

    return Category.findAll(query);
  }

  // Helper method to get direct children
  public async getChildren(includeInactive = false): Promise<Category[]> {
    const query: any = {
      where: {
        parentId: this.id
      }
    };

    if (!includeInactive) {
      query.where.isActive = true;
    }

    return Category.findAll(query);
  }

  // Helper method to get parent category
  public async getParent(): Promise<Category | null> {
    if (!this.parentId) return null;
    return Category.findByPk(this.parentId);
  }

  // Helper method to get full ancestry path
  public async getAncestry(): Promise<Category[]> {
    if (!this.path || this.path === '/') return [];
    
    const ancestorIds = this.path.split('/').filter(id => id).map(Number);
    if (ancestorIds.length === 0) return [];

    return Category.findAll({
      where: {
        id: ancestorIds
      },
      order: [['level', 'ASC']]
    });
  }

  // For TypeScript - will be initialized by associations
  public getProducts!: () => Promise<any[]>;
  public setProducts!: (products: any[]) => Promise<void>;
  public addProduct!: (product: any) => Promise<void>;
  public removeProduct!: (product: any) => Promise<void>;
  
  // Declare static methods
  static associate: (models: any) => void;
}

// Initialize Category model
Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '/',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    hooks: {
      // Auto-generate slug from name if not provided
      beforeValidate: (category: Category) => {
        if (!category.slug) {
          category.slug = category.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        }
      },
      // Update level and path based on parent
      beforeCreate: async (category: Category) => {
        if (category.parentId) {
          const parent = await Category.findByPk(category.parentId);
          if (parent) {
            category.level = parent.level + 1;
            category.path = `${parent.path}${parent.id}/`;
          } else {
            category.level = 0;
            category.path = '/';
          }
        } else {
          category.level = 0;
          category.path = '/';
        }
      },
      beforeUpdate: async (category: Category) => {
        // If parent ID changed, update level and path
        if (category.changed('parentId')) {
          if (category.parentId) {
            const parent = await Category.findByPk(category.parentId);
            if (parent) {
              category.level = parent.level + 1;
              category.path = `${parent.path}${parent.id}/`;
            } else {
              category.level = 0;
              category.path = '/';
            }
          } else {
            category.level = 0;
            category.path = '/';
          }
          
          // Update all child categories recursively
          const updateChildCategories = async (categoryId: number, level: number, path: string) => {
            const children = await Category.findAll({ where: { parentId: categoryId } });
            for (const child of children) {
              child.level = level + 1;
              child.path = `${path}${categoryId}/`;
              await child.save();
              await updateChildCategories(child.id, child.level, child.path);
            }
          };
          
          await updateChildCategories(category.id, category.level, category.path);
        }
      }
    },
    indexes: [
      {
        name: 'categories_path_idx',
        fields: ['path']
      }
    ]
  }
);

// Define self-referencing association for parent-child relationships
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parentId', as: 'subcategories' });

// Define the static associate method
Category.associate = (models) => {
  // Define association between products and categories
  Category.belongsToMany(models.Product, { 
    through: 'ProductCategory', 
    as: 'products' 
  });
};

export default Category;