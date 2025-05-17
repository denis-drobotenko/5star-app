require('dotenv').config();
const { Sequelize } = require('sequelize');
// const logger = require('./logger'); // logger больше не нужен здесь для logging: false

const sequelize = new Sequelize(
  process.env.DB_NAME || 'app',
  process.env.DB_USER || 'app',
  process.env.DB_PASSWORD || 'app',
  {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    // logging: msg => logger.debug(msg), // Заменяем на false
    logging: false, // Полностью отключаем логирование SQL-запросов Sequelize
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize; 