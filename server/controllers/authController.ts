import { Request, Response, NextFunction } from 'express';
// import { User, Company } from '../../shared/models/index.js'; // Не используется
// import { Op } from 'sequelize'; // Не используется
// import bcrypt from 'bcryptjs'; // Не используется
// import jwt from 'jsonwebtoken'; // Не используется
// import crypto from 'crypto'; // Не используется
import logger from '../config/logger.js';
// import emailService from '../services/emailService.js'; // Не используется
import authService from '../services/authService.js';
import { validate, loginSchema, registerSchema, requestPasswordResetSchema, resetPasswordSchema } from '../../shared/validators/authValidator.js';
// import { UserAttributes } from '../../shared/models/user.js'; // Не используется, если newUser типизирован сервисом

// const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key'; // Не используется локально

/**
 * Авторизация пользователя (логин)
 * @route POST /auth/login
 * @param {string} email - Email (req.body.email)
 * @param {string} password - Пароль (req.body.password)
 * @returns {Object} 200 - JWT и данные пользователя
 * @returns {Error} 401 - Неверный email или пароль
 */
async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { email, password } = req.body;
  const { password: _, ...bodyToLog } = req.body; 
  logger.info('[AuthController.login] Attempting login for email: %s. Body: %o', email, bodyToLog);

  try {
    const result = await authService.loginUser(email, password);
    logger.info('[AuthController.login] Login successful for %s. Sending response.', email);
    res.json(result);
  } catch (error: any) {
    logger.error('[AuthController.login] Login failed for email %s. Error: %s', email, error.message, {
      requestBody: bodyToLog,
    });
    if (error.status === 401) {
      res.status(401).json({ message: error.message });
      return;
    }
    next(error); // For other unexpected errors
  }
}

export const login = [validate(loginSchema), loginHandler];

/**
 * Регистрация нового пользователя
 * @route POST /auth/register
 * @param {string} email - Email (req.body.email)
 * @param {string} password - Пароль (req.body.password)
 * @param {string} fullName - ФИО (req.body.fullName)
 * @param {string} role - Роль (req.body.role)
 * @returns {Object} 201 - Данные созданного пользователя
 * @returns {Error} 400 - Email уже существует
 */
async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userData = req.body; 
  const { password: _, ...bodyToLog } = req.body;
  logger.info('[AuthController.register] Attempting to register user. Email: %s, Body: %o', userData.email, bodyToLog);

  try {
    const newUser = await authService.registerUser(userData);
    if (!newUser) { // Проверка, что newUser существует
      logger.error('[AuthController.register] User registration resulted in undefined user for email: %s', userData.email);
      res.status(500).json({ message: 'Ошибка регистрации: пользователь не был создан.' });
      return;
    }
    // Временно используем userData.email для логирования из-за проблем с выводом типа newUser.email
    logger.info('[AuthController.register] User with email %s registered successfully. Sending response.', userData.email);
    res.status(201).json(newUser); // Отправляем всего newUser, как и раньше
  } catch (error: any) {
    logger.error('[AuthController.register] Registration failed for email %s. Error: %s', userData.email, error.message, {
      requestBody: bodyToLog
    });
    if (error.status === 400) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    }
    next(error);
  }
}

export const register = [validate(registerSchema), registerHandler];

/**
 * Проверка валидности токена
 * @route GET /auth/verify
 * @returns {Object} 200 - Токен валиден
 * @returns {Error} 401 - Токен невалиден
 */
export function verify(req: Request, res: Response): void { // next удален
  const authHeader = req.headers.authorization;
  logger.info('[AuthController.verify] Verification request. Authorization header present: %s', !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('[AuthController.verify] Authorization header missing or not Bearer.');
    res.status(401).json({ message: 'Требуется авторизация (отсутствует Bearer token)' });
    return;
  }
  
  const token = authHeader.split(' ')[1];

  try {
    const userPayload = authService.verifyToken(token);
    logger.info('[AuthController.verify] Token successfully verified by service. User: %o', userPayload);
    res.json({ valid: true, user: userPayload });
  } catch (error: any) {
    logger.warn('[AuthController.verify] Token verification failed by service. Error: %s', error.message, { originalError: error.originalError });
    res.status(error.status || 401).json({ message: error.message, ...(error.originalError && { details: error.originalError.message || error.originalError }) });
  }
}

/**
 * Запрос на сброс пароля.
 * @route POST /auth/request-password-reset
 * @param {string} email - Email пользователя (req.body.email)
 * @returns {Object} 200 - Сообщение об успехе
 */
async function requestPasswordResetHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { email } = req.body;
  logger.info('[AuthController.requestPasswordReset] Request received for email: %s. Requesting user (if any): %o', 
    email, 
    req.user ? { id: (req.user as any).id, role: (req.user as any).role } : { id: 'undefined' }
  );

  try {
    await authService.requestPasswordResetForUser(email);

    logger.info('[AuthController.requestPasswordReset] Generic success response sent for email %s.', email);
    res.status(200).json({ message: 'Если пользователь с таким email существует, ему будет отправлена ссылка для сброса пароля.' });
  } catch (error: any) {
    logger.error('[AuthController.requestPasswordReset] Failed to process password reset request for %s. Error: %s', email, error.message, {
      error: { message: error.message, stack: error.stack, name: error.name },
      requestBody: req.body,
      requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role } : null
    });
    next(error);
  }
}

export const requestPasswordReset = [validate(requestPasswordResetSchema), requestPasswordResetHandler];

/**
 * Сброс пароля пользователя.
 * @route POST /auth/reset-password
 * @param {string} token - Токен сброса (req.body.token)
 * @param {string} password - Новый пароль (req.body.password)
 * @returns {Object} 200 - Сообщение об успехе
 */
async function resetPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
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
  } catch (error: any) {
    logger.error('[AuthController.resetPassword] Failed to reset password for token (first 8 chars): %s. Error: %s', 
      token ? token.substring(0,8) : '[NO TOKEN PROVIDED]', 
      error.message, 
      { requestBody: bodyToLog }
    );
    if (error.status === 400) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error.name === 'SequelizeValidationError') {
      res.status(400).json({ message: 'Ошибка валидации нового пароля: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    }
    next(error);
  }
}

export const resetPassword = [validate(resetPasswordSchema), resetPasswordHandler]; 