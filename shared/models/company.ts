import { DataTypes, Model, CreationOptional } from 'sequelize';

export interface ICompanyAttributes {
  id: number;
  client_id?: number | null; // Может быть не у всех компаний, если это так
  name: string;
  inn: string;
  kpp?: string | null;
  legal_address?: string | null;
  postal_address?: string | null;
  actual_address?: string | null;
  bank_details?: string | null;
  edo_provider_name?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface ICompanyCreationAttributes extends Omit<ICompanyAttributes, 'id' | 'created_at' | 'updated_at'> {}

export default (sequelize: any) => {
  class Company extends Model<ICompanyAttributes, ICompanyCreationAttributes> {
    declare id: CreationOptional<number>;
    declare client_id: number | null;
    declare name: string;
    declare inn: string;
    declare kpp: string | null;
    declare legal_address: string | null;
    declare postal_address: string | null;
    declare actual_address: string | null;
    declare bank_details: string | null;
    declare edo_provider_name: string | null;
    declare readonly created_at: CreationOptional<Date>; 
    declare readonly updated_at: CreationOptional<Date>;

    static associate(models: any) {
      // Компания принадлежит одному клиенту
      Company.belongsTo(models.Client, { 
        foreignKey: 'client_id', 
        as: 'client' 
      });
      // Компания может иметь много пользователей
      Company.hasMany(models.User, { 
        foreignKey: 'company_id', 
        as: 'users' 
      });
    }
  }

  Company.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clients', // Имя таблицы для связи
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    inn: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    kpp: {
      type: DataTypes.STRING,
      allowNull: true // Разрешаем null, если kpp может отсутствовать
    },
    legal_address: {
      type: DataTypes.STRING,
      allowNull: true // Разрешаем null
    },
    postal_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    actual_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bank_details: {
      type: DataTypes.STRING,
      allowNull: true // Разрешаем null
    },
    edo_provider_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // created_at и updated_at управляются Sequelize через timestamps: true
  }, {
    sequelize,
    tableName: 'companies',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  return Company;
}; 