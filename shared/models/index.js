import { Sequelize } from 'sequelize';
import userFactory from './user.ts';
import companyFactory from './company.ts';
import clientFactory from './client.ts';
import fieldMappingFactory from './fieldMapping.js';
import importHistoryFactory from './importHistory.js';
import orderFactory from './order.js';
// Создание экземпляра Sequelize
export const sequelize = new Sequelize(process.env.DB_NAME || 'app', process.env.DB_USER || 'app', process.env.DB_PASSWORD || 'app', {
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    benchmark: true,
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});
export const User = userFactory(sequelize);
export const Company = companyFactory(sequelize);
export const Client = clientFactory(sequelize);
export const FieldMapping = fieldMappingFactory(sequelize);
export const ImportHistory = importHistoryFactory(sequelize);
export const Order = orderFactory(sequelize);

// Вызываем методы associate для всех моделей, у которых они есть
const models = { User, Company, Client, FieldMapping, ImportHistory, Order };
for (const modelName in models) {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
}

// Здесь можно добавить ассоциации между моделями (или вынести в отдельный файл)
export const initializeDatabase = async () => {
    await sequelize.sync();
};
