const express = require('express');
const path = require('path');
const sequelize = require('./config/database');
require('dotenv').config();

const app = express();
app.use(express.json());

// Делаем документацию JSDoc доступной по /docs
app.use('/docs', express.static(path.join(__dirname, '../docs')));

// Пример базового роутинга
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Проверка подключения к БД при запуске
sequelize.authenticate()
  .then(() => console.log('База данных подключена'))
  .catch(err => console.error('Ошибка подключения к БД:', err));

/**
 * Проверка работоспособности JSDoc.
 * @returns {string}
 */
function testDoc() {
  return 'JSDoc работает!';
}

module.exports = app;
