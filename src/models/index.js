const { Umzug, SequelizeStorage } = require('umzug');
const { Sequelize, QueryTypes } = require('sequelize'); // Sequelize нужен для resolve в umzug, QueryTypes для raw запросов
const sequelize = require('../config/database');
const logger = require('../config/logger');
const User = require('./user');
const Company = require('./company');
const Client = require('./client');
const FieldMapping = require('./fieldMapping');
const ImportHistory = require('./importHistory');
const Order = require('./order');

// Определяем связи между моделями
// Связи для Client
Client.hasMany(Company, { foreignKey: 'client_id', as: 'companies' });
Client.hasMany(User, { foreignKey: 'client_id', as: 'users' });
Client.hasMany(FieldMapping, { foreignKey: 'client_id', as: 'fieldMappings' });
Client.hasMany(ImportHistory, { foreignKey: 'client_id', as: 'importHistories' });
Client.hasMany(Order, { foreignKey: 'client_id', as: 'orders' });

// Связи для Company
Company.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
Company.hasMany(ImportHistory, { foreignKey: 'company_id', as: 'importHistories' });

// Связи для User
User.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
User.hasMany(ImportHistory, { foreignKey: 'user_id', as: 'importHistories' });

// Связи для FieldMapping
FieldMapping.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
FieldMapping.hasMany(ImportHistory, { foreignKey: 'field_mapping_id', as: 'importHistories' });

// Связи для ImportHistory
ImportHistory.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
ImportHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ImportHistory.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
ImportHistory.belongsTo(FieldMapping, { foreignKey: 'field_mapping_id', as: 'fieldMapping' });

// Связи для Order (если они будут определены позже)
Order.belongsTo(ImportHistory, { foreignKey: 'session_id', targetKey: 'id', as: 'importSession' });
Order.belongsTo(Client, { foreignKey: 'client_id', as: 'client' }); // Связь Order -> Client

// Настройка Umzug
const umzug = new Umzug({
  migrations: {
    glob: 'migrations/*.js', // Убедитесь, что этот путь соответствует .sequelizerc (относительно корня проекта)
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context, Sequelize), 
        down: async () => migration.down(context, Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: logger, // Используем наш winston логгер
});

// Функция для выполнения миграций
const runMigrations = async () => {
  try {
    logger.info('[Migrations] Checking and running pending migrations...');
    const pendingMigrations = await umzug.pending();
    if (pendingMigrations.length > 0) {
      logger.info(`[Migrations] Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.map(m => m.name).join(', ')}`);
      await umzug.up();
      logger.info('[Migrations] All pending migrations have been executed successfully.');
    } else {
      logger.info('[Migrations] No pending migrations found. Database is up to date.');
    }
  } catch (error) {
    logger.error('[Migrations] Error running migrations:', { message: error.message, stack: error.stack });
    throw error; 
  }
};

// Инициализация БД и миграций (замена syncModels)
const initializeDatabase = async () => {
  try {
    logger.info('[DB Init] Attempting sequelize.authenticate()...');
    await sequelize.authenticate();
    logger.info('[DB Init] sequelize.authenticate() SUCCEEDED.');

    // --- НАЧАЛО БЛОКА: Проверка и создание SequelizeMeta для начальной миграции ---
    const initialMigrationName = '20250520075059-initial-schema.js'; // Имя нашей начальной миграции
    try {
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY);`,
        { type: QueryTypes.RAW }
      );
      // Проверяем, есть ли уже запись
      const result = await sequelize.query(
        `SELECT "name" FROM "SequelizeMeta" WHERE "name" = :migrationName;`,
        {
          replacements: { migrationName: initialMigrationName },
          type: QueryTypes.SELECT,
        }
      );
      if (result.length === 0) {
        await sequelize.query(
          `INSERT INTO "SequelizeMeta" ("name") VALUES (:migrationName) ON CONFLICT ("name") DO NOTHING;`,
          {
            replacements: { migrationName: initialMigrationName },
            type: QueryTypes.INSERT,
          }
        );
        logger.info(`[DB Init] Initial migration '${initialMigrationName}' was not in SequelizeMeta, record added.`);
      } else {
        logger.info(`[DB Init] Initial migration '${initialMigrationName}' already recorded in SequelizeMeta.`);
      }
    } catch (metaError) {
      logger.error(`[DB Init] Error during SequelizeMeta check/setup for initial migration: ${metaError.message}`, { error: metaError });
      // Можно решить пробросить ошибку, если это критично
      // throw metaError; 
    }
    // --- КОНЕЦ БЛОКА ---

    // Запускаем миграции вместо sequelize.sync()
    // В production миграции обычно применяются отдельной командой при деплое.
    if (process.env.NODE_ENV !== 'production') { 
      await runMigrations();
    } else {
      logger.info('[DB Init] Migrations are not run automatically in production. Please run them manually if needed.');
      // Можно добавить проверку актуальности схемы, если это необходимо
      const pending = await umzug.pending();
      if (pending.length > 0) {
        logger.warn(`[DB Init] THERE ARE ${pending.length} PENDING MIGRATIONS! Run them manually: ${pending.map(m => m.name).join(', ')}`);
      }
    }
    
    // Старый код sequelize.sync() и миграции данных УДАЛЕН, так как перенесен в миграции.
    // logger.info('[DataMigration] Data migration block for existing users is commented out (to be moved to a seeder/migration).');

  } catch (error) {
    logger.error(`[DB Init] Error during database initialization or migration: ${error.message}`, { error });
    throw error;
  }
};

module.exports = {
  sequelize,
  initializeDatabase, // Новая функция
  runMigrations,      // Для возможного отдельного вызова
  umzug,              // Для CLI или тестов
  User,
  Company,
  Client,
  FieldMapping,
  ImportHistory,
  Order,
}; 