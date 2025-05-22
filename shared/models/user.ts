import { DataTypes, Model, CreationOptional } from 'sequelize';

export interface IUserAttributes {
  id: number;
  username: string;
  password_hash: string;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  position?: string | null;
  role: string;
  user_type: string;
  is_active: boolean;
  client_id?: number | null;
  company_id?: number | null;
  reset_password_token?: string | null;
  reset_password_expires_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface IUserCreationAttributes extends Omit<IUserAttributes, 'id' | 'created_at' | 'updated_at'> {
  // `password_hash` обязателен при создании, как и `username`, `email`, `role`, `user_type`
  // `is_active` имеет defaultValue, так что опционально
  // Остальные (`full_name`, `phone`, `position`, `client_id`, `company_id`, `reset_password_token`, `reset_password_expires_at`) опциональны
}

export default (sequelize: any) => {
  class User extends Model<IUserAttributes, IUserCreationAttributes> {
    declare id: CreationOptional<number>;
    declare username: string;
    declare password_hash: string;
    declare full_name: string | null;
    declare email: string;
    declare phone: string | null;
    declare position: string | null;
    declare role: string;
    declare user_type: string;
    declare is_active: boolean;
    declare client_id: number | null;
    declare company_id: number | null;
    declare reset_password_token: string | null;
    declare reset_password_expires_at: Date | null;
    declare readonly created_at: CreationOptional<Date>; 
    declare readonly updated_at: CreationOptional<Date>;

    static associate(models: any) { 
      User.belongsTo(models.Client, {
        foreignKey: 'client_id',
        as: 'client'
      });
      User.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company'
      });
    }
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    user_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['INTERNAL', 'CLIENT']]
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reset_password_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reset_password_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false
    }
  }, {
    sequelize,
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  });

  return User;
};