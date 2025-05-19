const sequelize = require('../config/database');
const logger = require('../config/logger');
const User = require('./user');
const Company = require('./company');
const Client = require('./client');
const FieldMapping = require('./fieldMapping');

// Определяем связи между моделями
// Связи для Client
Client.hasMany(Company, { foreignKey: 'client_id', as: 'companies' });
Client.hasMany(User, { foreignKey: 'client_id', as: 'users' });
Client.hasMany(FieldMapping, { foreignKey: 'client_id', as: 'fieldMappings' });

// Связи для Company
Company.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

// Связи для User
User.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Связи для FieldMapping
FieldMapping.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });

// Синхронизируем модели с БД
const syncModels = async () => {
  try {
    await sequelize.authenticate();
    // logger.info('База данных подключена');

    await sequelize.sync(); 
    
    // logger.info('Модели синхронизированы с БД (только создание несуществующих таблиц). Запускаем миграцию данных для существующих пользователей...');

    const [updatedUserTypeCount] = await User.update(
      { user_type: 'INTERNAL' },
      {
        where: {
          user_type: null,
        },
        returning: false, 
      }
    );
    // if (updatedUserTypeCount > 0) {
    //   logger.info(`[DataMigration] Установлен user_type='INTERNAL' для ${updatedUserTypeCount} пользователей.`);
    // }

    const [updatedUpdatedAtCount] = await User.update(
      { updated_at: sequelize.fn('NOW') },
      {
        where: {
          updated_at: null,
        },
        returning: false, 
      }
    );
    // if (updatedUpdatedAtCount > 0) {
    //   logger.info(`[DataMigration] Обновлен updated_at для ${updatedUpdatedAtCount} пользователей.`);
    // }

    const [updatedCreatedAtCount] = await User.update(
      { created_at: sequelize.fn('NOW') },
      {
        where: {
          created_at: null,
        },
        returning: false, 
      }
    );
    // if (updatedCreatedAtCount > 0) {
    //   logger.info(`[DataMigration] Обновлен created_at для ${updatedCreatedAtCount} пользователей.`);
    // }

    logger.info('[DataMigration] Миграция данных для существующих пользователей завершена.');

  } catch (error) {
    logger.error(`Ошибка синхронизации моделей с БД: ${error.message}`, { error });
    throw error;
  }
};

module.exports = {
  sequelize,
  syncModels,
  User,
  Company,
  Client,
  FieldMapping,
}; 