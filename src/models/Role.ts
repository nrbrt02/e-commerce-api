import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

// Role attributes interface
export interface RoleAttributes {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for optional attributes during creation
interface RoleCreationAttributes extends Optional<RoleAttributes, 'id' | 'description' | 'permissions' | 'createdAt' | 'updatedAt'> {}

// Role model class
class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public permissions!: string[];
  public createdAt!: Date;
  public updatedAt!: Date;
}

// Initialize Role model
Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
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
    modelName: 'Role',
    tableName: 'roles',
  }
);

export default Role;