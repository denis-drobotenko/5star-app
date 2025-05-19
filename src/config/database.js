require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('./logger'); // Раскомментируем и используем logger

const sequelize = new Sequelize(
  process.env.DB_NAME || 'app',
  process.env.DB_USER || 'app',
  process.env.DB_PASSWORD || 'app',
  {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    benchmark: true, // Включаем бенчмаркинг для получения времени выполнения в объекте метаданных
    logging: (sql, timingOrMetadata) => {
      if (typeof timingOrMetadata === 'number') {
        // Это прямой замер времени, если Sequelize его предоставляет
        // logger.debug(`[Sequelize] Execution time: ${timingOrMetadata}ms --- Query: ${sql}`);
      } else if (timingOrMetadata && typeof timingOrMetadata === 'object' && typeof timingOrMetadata.duration === 'number') {
        // Если включен benchmark: true, Sequelize передает объект с полем duration
        // logger.debug(`[Sequelize] Execution time: ${timingOrMetadata.duration}ms --- Query: ${sql}`);
      } else {
        // Для других сообщений Sequelize или если время не доступно напрямую
        // logger.debug(`[Sequelize] Query: ${sql}`);
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize; 