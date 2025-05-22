import { DataTypes, Model, CreationOptional } from 'sequelize';

// Интерфейс для атрибутов клиента
export interface IClientAttributes {
  id: number;
  name: string;
  logo_url?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

// Интерфейс для создания клиента (некоторые поля опциональны)
interface IClientCreationAttributes extends Omit<IClientAttributes, 'id' | 'created_at' | 'updated_at'> {}

export default (sequelize: any) => {
  class Client extends Model<IClientAttributes, IClientCreationAttributes> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare logo_url: string | null;
    declare readonly created_at: CreationOptional<Date>;
    declare readonly updated_at: CreationOptional<Date>;

    static associate(models: any) {
      // Клиент может иметь много компаний
      Client.hasMany(models.Company, { 
        foreignKey: 'client_id', 
        as: 'companies' 
      });
      // Клиент может иметь много пользователей (если такая связь нужна и есть client_id в User)
      Client.hasMany(models.User, { 
        foreignKey: 'client_id', 
        as: 'users' 
      });
    }
  }

  Client.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    logo_url: {
      type: DataTypes.TEXT, // В MySQL/PostgreSQL TEXT подходит для URL любой длины
      allowNull: true,
    },
    // created_at и updated_at управляются Sequelize через timestamps: true
  }, {
    sequelize,
    tableName: 'clients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  });

  return Client;
}; 