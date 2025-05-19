const { User, Company } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../config/logger');
const emailService = require('../services/emailService');

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

/**
 * Запрос на сброс пароля.
 * @route POST /auth/request-password-reset
 * @param {string} email - Email пользователя (req.body.email)
 * @returns {Object} 200 - Сообщение об успехе
 * @returns {Error} 404 - Пользователь не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function requestPasswordReset(req, res) {
  logger.info(`[AuthController.requestPasswordReset] Request received for email: ${req.body.email}`);
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      logger.warn(`[AuthController.requestPasswordReset] User with email ${email} not found. Proceeding to send generic success message.`);
      return res.status(200).json({ message: 'Если пользователь с таким email существует, ему будет отправлена ссылка для сброса пароля.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    user.reset_password_token = hashedToken;
    user.reset_password_expires_at = expiresAt;
    await user.save();

    await emailService.sendPasswordResetEmail(user.email, resetToken);
    logger.info(`[AuthController.requestPasswordReset] Password reset process initiated for ${email}. Email should be sent.`);

    res.status(200).json({ message: 'Если пользователь с таким email существует, ему будет отправлена ссылка для сброса пароля.' });

  } catch (error) {
    logger.error('[AuthController.requestPasswordReset] Error during password reset request:', { errorMessage: error.message, errorStack: error.stack, errorFull: error });
    res.status(500).json({ message: 'Ошибка сервера при запросе сброса пароля.' });
  }
}

/**
 * Сброс пароля пользователя.
 * @route POST /auth/reset-password
 * @param {string} token - Токен сброса (req.body.token)
 * @param {string} password - Новый пароль (req.body.password)
 * @returns {Object} 200 - Сообщение об успехе
 * @returns {Error} 400 - Невалидный/просроченный токен или ошибка валидации
 * @returns {Error} 500 - Ошибка сервера
 */
async function resetPassword(req, res) {
  logger.info(`[AuthController.resetPassword] Request received. Body: ${JSON.stringify(req.body)}`);
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      logger.warn(`[AuthController.resetPassword] Token or password missing. Token: ${token}, Password provided: ${!!password}`);
      return res.status(400).json({ message: 'Токен и новый пароль обязательны.' });
    }
    
    if (password.length < 6) {
        logger.warn(`[AuthController.resetPassword] Password too short. Length: ${password.length}`);
        return res.status(400).json({ message: 'Пароль должен быть не менее 6 символов.'});
    }

    // Хешируем токен, полученный от клиента, для сравнения с тем, что в БД
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    logger.info(`[AuthController.resetPassword] Received raw token: ${token}, Hashed token for DB lookup: ${hashedToken}`);

    logger.info(`[AuthController.resetPassword] Preparing to query user. Current time for query: ${new Date().toISOString()}`); // Новый лог
    const user = await User.findOne({
      where: {
        reset_password_token: hashedToken,
        reset_password_expires_at: { [Op.gt]: new Date() }
      }
    });
    logger.info(`[AuthController.resetPassword] User.findOne executed. User found: ${!!user ? user.id : 'null'}`); // Новый лог

    if (!user) {
      logger.warn(`[AuthController.resetPassword] User not found or token expired for hashed token: ${hashedToken}. Current time: ${new Date().toISOString()}`);
      // Дополнительно проверим, есть ли токен вообще, но он истек
      const expiredUser = await User.findOne({ where: { reset_password_token: hashedToken } });
      if (expiredUser) {
        logger.warn(`[AuthController.resetPassword] Token was found for hashed token: ${hashedToken}, but it has expired. Expiry time: ${expiredUser.reset_password_expires_at}`);
      } else {
        logger.warn(`[AuthController.resetPassword] No user record found for hashed token: ${hashedToken} at all.`);
      }
      return res.status(400).json({ message: 'Токен для сброса пароля недействителен или истек.' });
    }

    logger.info(`[AuthController.resetPassword] User found for token. User ID: ${user.id}. Proceeding to hash new password.`);
    const newPasswordHash = await bcrypt.hash(password, 10);

    user.password_hash = newPasswordHash;
    user.reset_password_token = null;
    user.reset_password_expires_at = null;
    await user.save();

    logger.info(`[AuthController.resetPassword] Password for user ${user.id} has been reset successfully.`);
    res.status(200).json({ message: 'Пароль успешно изменен.' });

  } catch (error) {
    logger.error(
        `[AuthController.resetPassword] Critical error during password reset process. Message: ${error.message}. Stack: ${error.stack}. Error Name: ${error.name}. Error Code: ${error.code}`, 
        { errorFull: JSON.stringify(error, Object.getOwnPropertyNames(error), 2) } // Улучшенное логирование объекта ошибки
    );
    res.status(500).json({ message: 'Ошибка сервера при сбросе пароля.' });
  }
}

module.exports = { login, register, verify, requestPasswordReset, resetPassword }; 