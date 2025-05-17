const { User, Company } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

/**
 * Авторизация пользователя (логин)
 * @route POST /auth/login
 * @param {string} email - Email (req.body.email)
 * @param {string} password - Пароль (req.body.password)
 * @returns {Object} 200 - JWT и данные пользователя
 * @returns {Error} 401 - Неверный email или пароль
 */
function login(req, res) {
  logger.info(`[AuthController.login] ENTERED function. Request headers: ${JSON.stringify(req.headers)}, Request body: ${JSON.stringify(req.body)}`);

  const { email, password } = req.body;
  logger.info(`[AuthController.login] Попытка входа. Email: ${email}. Тело запроса: ${JSON.stringify(req.body)}`);
  User.findOne({ 
    where: { email },
    include: [{
      model: Company,
      as: 'company',
      attributes: ['id', 'name']
    }]
  })
    .then(user => {
      logger.info(`[AuthController.login] User.findOne .then() callback ENTERED. User found: ${!!user}`);
      if (!user) {
        logger.warn(`[AuthController.login] Пользователь с email ${email} не найден.`);
        return res.status(401).json({ message: 'Неверный email или пароль' });
      }
      logger.info(`[AuthController.login] Пользователь ${email} найден. ID: ${user.id}, Role: ${user.role}. Сравнение пароля... Поле хеша: ${user.password_hash ? 'доступно' : 'НЕ ДОСТУПНО'}`);
      return bcrypt.compare(password, user.password_hash)
        .then(isMatch => {
          logger.info(`[AuthController.login] bcrypt.compare .then() callback ENTERED. isMatch: ${isMatch}`);
          logger.info(`[AuthController.login] Результат сравнения пароля для ${email}: ${isMatch}`);
          if (!isMatch) {
            logger.warn(`[AuthController.login] Неверный пароль для пользователя ${email}.`);
            return res.status(401).json({ message: 'Неверный email или пароль' });
          }
          logger.info(`[AuthController.login] Пароль для ${email} верный. Генерация JWT...`);
          
          const token = jwt.sign({ 
            id: user.id, 
            role: user.role, 
            email: user.email,
            company_id: user.company_id
          }, JWT_SECRET, { expiresIn: '12h' });
          
          logger.info(`[AuthController.login] JWT для ${email} сгенерирован. Отправка ответа.`);
          res.json({ 
            token, 
            user: { 
              id: user.id, 
              email: user.email, 
              fullName: user.fullName,
              role: user.role,
              company_id: user.company_id,
              company: user.company
            } 
          });
        })
        .catch(bcryptErr => {
          logger.error(`[AuthController.login] bcrypt.compare .catch() callback ENTERED. Error: ${bcryptErr.message}`, { error: bcryptErr, stack: bcryptErr.stack });
          res.status(500).json({ message: 'Ошибка сервера при проверке пароля', error: bcryptErr.message });
        });
    })
    .catch(err => {
      logger.error(`[AuthController.login] User.findOne .catch() callback ENTERED. Error: ${err.message}`, { error: err, stack: err.stack });
      res.status(500).json({ message: 'Ошибка сервера', error: err.message });
    });
}

/**
 * Регистрация нового пользователя (только для теста/первого пользователя)
 * @route POST /auth/register
 * @param {string} email - Email (req.body.email)
 * @param {string} password - Пароль (req.body.password)
 * @param {string} fullName - ФИО (req.body.fullName)
 * @param {string} role - Роль (req.body.role)
 * @returns {Object} 201 - Данные созданного пользователя
 * @returns {Error} 400 - Email уже существует
 */
function register(req, res) {
  const { email, password, fullName, role } = req.body;
  User.findOne({ where: { email } })
    .then(exists => {
      if (exists) return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
      return bcrypt.hash(password, 10)
        .then(hash => User.create({ email, password: hash, fullName, role }))
        .then(user => res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role }));
    })
    .catch(err => res.status(500).json({ message: 'Ошибка сервера', error: err.message }));
}

/**
 * Проверка валидности токена
 * @route GET /auth/verify
 * @returns {Object} 200 - Токен валиден
 * @returns {Error} 401 - Токен невалиден
 */
function verify(req, res) {
  const authHeader = req.headers.authorization;
  logger.info(`[AuthVerify] Запрос на /auth/verify. Заголовок Authorization: ${authHeader}`);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('[AuthVerify] Заголовок Authorization отсутствует или не начинается с "Bearer ".');
    return res.status(401).json({ message: 'Требуется авторизация' });
  }
  
  const token = authHeader.split(' ')[1];
  logger.info(`[AuthVerify] Извлеченный токен: ${token}`);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    logger.info(`[AuthVerify] Токен валиден. Payload: ${JSON.stringify(payload)}`);
    res.json({ valid: true, user: payload });
  } catch (err) {
    logger.error(`[AuthVerify] Ошибка проверки токена: ${err.message}. Токен: ${token}`);
    res.status(401).json({ message: 'Неверный или просроченный токен', error: err.message });
  }
}

module.exports = { login, register, verify }; 