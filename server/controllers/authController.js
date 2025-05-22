const { User, Company } = require('../../shared/models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../config/logger');
const emailService = require('../services/emailService');
const authService = require('../services/authService');
const { validate, loginSchema, registerSchema, requestPasswordResetSchema, resetPasswordSchema } = require('../../shared/validators/authValidator');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

/**
 * Авторизация пользователя (логин)
 * @route POST /auth/login
 * @param {string} email - Email (req.body.email)
 * @param {string} password - Пароль (req.body.password)
 * @returns {Object} 200 - JWT и данные пользователя
 * @returns {Error} 401 - Неверный email или пароль
 */
async function login(req, res, next) {
  const { email, password } = req.body;
  const { password: _, ...bodyToLog } = req.body; 
  logger.info('[AuthController.login] Attempting login for email: %s. Body: %o', email, bodyToLog);

  try {
    const result = await authService.loginUser(email, password);
    logger.info('[AuthController.login] Login successful for %s. Sending response.', email);
    res.json(result);
  } catch (error) {
    logger.error('[AuthController.login] Login failed for email %s. Error: %s', email, error.message, {
      // error object itself might be logged by the service or here if needed for controller context
      requestBody: bodyToLog,
      // email: email // Already in message
    });
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    next(error); // For other unexpected errors
  }
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
async function register(req, res, next) {
  // Данные пользователя из тела запроса (провалидированы схемой authValidator.registerSchema)
  const userData = req.body; 
  const { password: _, ...bodyToLog } = req.body;
  logger.info('[AuthController.register] Attempting to register user. Email: %s, Body: %o', userData.email, bodyToLog);

  try {
    const newUser = await authService.registerUser(userData);
    logger.info('[AuthController.register] User %s registered successfully. Sending response.', newUser.email);
    res.status(201).json(newUser);
  } catch (error) {
    logger.error('[AuthController.register] Registration failed for email %s. Error: %s', userData.email, error.message, {
      // error: error, // logged by service
      requestBody: bodyToLog
    });
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'SequelizeValidationError') { // Эта ошибка должна обрабатываться в сервисе, но на всякий случай
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    }
    next(error);
  }
}

/**
 * Проверка валидности токена
 * @route GET /auth/verify
 * @returns {Object} 200 - Токен валиден
 * @returns {Error} 401 - Токен невалиден
 */
function verify(req, res, next) {
  const authHeader = req.headers.authorization;
  logger.info('[AuthController.verify] Verification request. Authorization header present: %s', !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('[AuthController.verify] Authorization header missing or not Bearer.');
    return res.status(401).json({ message: 'Требуется авторизация (отсутствует Bearer token)' });
  }
  
  const token = authHeader.split(' ')[1];
  // logger.debug('[AuthController.verify] Extracted token: %s', token ? 'present' : 'absent'); // Service will log

  try {
    const userPayload = authService.verifyToken(token);
    logger.info('[AuthController.verify] Token successfully verified by service. User: %o', userPayload);
    res.json({ valid: true, user: userPayload });
  } catch (error) {
    // Ошибка от сервиса уже будет содержать статус 401 и сообщение
    logger.warn('[AuthController.verify] Token verification failed by service. Error: %s', error.message, { originalError: error.originalError });
    res.status(error.status || 401).json({ message: error.message, ...(error.originalError && { details: error.originalError }) });
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
async function requestPasswordReset(req, res, next) {
  const { email } = req.body;
  logger.info('[AuthController.requestPasswordReset] Request received for email: %s. Requesting user (if any): %o', 
    email, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    // Предполагаем, что FRONTEND_URL доступен, например, из .env
    // TODO: Убедиться, что process.env.FRONTEND_URL настроен и корректен
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Дефолт для локальной разработки
    const resetUrlBase = `${frontendUrl}/reset-password?token=`; 

    // Сервис вернет true если пользователь найден и email отправлен (или должен был быть отправлен)
    // Сервис вернет false если пользователь не найден (чтобы не раскрывать информацию)
    // или если произошла ошибка отправки email (сервис это логирует)
    await authService.requestPasswordResetForUser(email, resetUrlBase);

    // Всегда возвращаем одинаковый ответ, чтобы не раскрывать, существует ли email в системе
    logger.info('[AuthController.requestPasswordReset] Generic success response sent for email %s (actual outcome logged by service).', email);
    res.status(200).json({ message: 'Если пользователь с таким email существует, ему будет отправлена ссылка для сброса пароля.' });

  } catch (error) {
    // Этот блок будет вызван только если сам сервис выбросит неожиданную ошибку (не ошибку "пользователь не найден" или "ошибка отправки email")
    logger.error('[AuthController.requestPasswordReset] Failed to process password reset request for %s. Error: %s', email, error.message, {
      error: error,
      requestBody: req.body,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    next(error);
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
async function resetPassword(req, res, next) {
  const { token, password } = req.body;
  const { password: _, ...bodyToLog } = req.body;
  logger.info('[AuthController.resetPassword] Attempting to reset password with token (first 8 chars): %s. Body: %o', 
    token ? token.substring(0,8) : '[NO TOKEN PROVIDED]', 
    bodyToLog
  );

  try {
    await authService.resetUserPassword(token, password);
    logger.info('[AuthController.resetPassword] Password reset successful for token (first 8 chars): %s.', token ? token.substring(0,8) : '[NO TOKEN PROVIDED]');
    res.json({ message: 'Пароль успешно сброшен.' });

  } catch (error) {
    logger.error('[AuthController.resetPassword] Failed to reset password for token (first 8 chars): %s. Error: %s', 
      token ? token.substring(0,8) : '[NO TOKEN PROVIDED]', 
      error.message, 
      {
        // error: error, // logged by service
        requestBody: bodyToLog
      }
    );
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'SequelizeValidationError') { // Если вдруг валидация на модель User не прошла
      return res.status(400).json({ message: 'Ошибка валидации нового пароля: ' + error.errors.map(e => e.message).join(', ') });
    }
    next(error);
  }
}

module.exports = {
  login: [validate(loginSchema), login],
  register: [validate(registerSchema), register],
  verify,
  requestPasswordReset: [validate(requestPasswordResetSchema), requestPasswordReset],
  resetPassword: [validate(resetPasswordSchema), resetPassword],
}; 