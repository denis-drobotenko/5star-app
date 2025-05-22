require('dotenv').config(); // Загружает переменные из .env в process.env

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    dialect: 'postgres'
    // dialectOptions: { // Раскомментировать и настроить, если нужен SSL
    //   ssl: {
    //     require: true, // или false, если SSL не обязателен
    //     rejectUnauthorized: false // В development можно false, в production лучше настроить CA
    //   }
    // }
  },
  test: {
    username: process.env.DB_USER_TEST || process.env.DB_USER, // Пример для тестовой БД
    password: process.env.DB_PASSWORD_TEST || process.env.DB_PASSWORD,
    database: process.env.DB_NAME_TEST || 'database_test',
    host: process.env.DB_HOST_TEST || process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT_TEST || process.env.DB_PORT, 10),
    dialect: 'postgres',
    logging: false // Отключить логирование для тестов
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    dialect: 'postgres'
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false // ВНИМАНИЕ: Для production настройте CA или используйте другие методы!
    //   }
    // }
  }
}; 