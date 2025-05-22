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
      // Расширенное логирование для лучшего понимания запросов и времени их выполнения
      if (typeof timingOrMetadata === 'number') {
        // logger.debug(`[Sequelize] Execution time: ${timingOrMetadata}ms --- Query: ${sql}`);
      } else if (typeof timingOrMetadata === 'object' && timingOrMetadata !== null && 'duration' in timingOrMetadata) {
        // logger.debug(`[Sequelize] Execution time: ${timingOrMetadata.duration}ms --- Query: ${sql}`);
      } else {
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