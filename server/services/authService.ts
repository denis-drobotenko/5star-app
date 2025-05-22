import { User, Company, sequelize } from '../../shared/models/index.js';
import { UserAttributes, UserCreationAttributes } from '../../shared/models/user.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../config/logger.js'; // Предполагается, что logger.js экспортирует по умолчанию
import emailService from './emailService.js'; // Предполагаем, что emailService уже есть или будет создан

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

class ApiError extends Error {
  status?: number;
  originalError?: any; // Можно оставить any или типизировать Error
  constructor(message: string, status?: number, originalError?: any) {
    super(message);
    this.status = status;
    this.originalError = originalError;
    Object.setPrototypeOf(this, ApiError.prototype); // Для корректной работы instanceof
  }
}

async function loginUser(email: string, password: string): Promise<{ token: string; user: Partial<UserAttributes> }> {
  logger.debug('[AuthService.loginUser] Attempting login for email: %s', email);
  const user = await User.findOne({
    where: { email },
    include: [{
      model: Company,
      as: 'company',
      attributes: ['id', 'name']
    }]
  });

  if (!user) {
    logger.warn('[AuthService.loginUser] User with email %s not found.', email);
    const error = new ApiError('Неверный email или пароль', 401);
    throw error;
  }
  logger.debug('[AuthService.loginUser] User %s found. ID: %s. Comparing password.', email, user.id);

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    logger.warn('[AuthService.loginUser] Invalid password for user %s.', email);
    const error = new ApiError('Неверный email или пароль', 401);
    throw error;
  }
  logger.debug('[AuthService.loginUser] Password for %s is correct. Generating JWT.', email);

  const tokenPayload = {
    id: user.id,
    role: user.role, // user.role может не существовать, если UserAttributes не включает его явно
    email: user.email,
    client_id: user.client_id, // Аналогично для client_id
    company_id: user.company_id // Аналогично для company_id
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

  // Используем Partial<UserAttributes> для безопасности и гибкости
  const userResponse: Partial<UserAttributes> = { ...user.get({ plain: true }) }; 
  delete userResponse.password_hash;

  logger.info('[AuthService.loginUser] JWT for %s generated.', email);
  return { token, user: userResponse };
}

// Используем UserCreationAttributes для userData, это тип для Sequelize Model.create()
async function registerUser(userData: UserCreationAttributes): Promise<Partial<UserAttributes> | undefined> {
  const { email } = userData; // Удалены password_hash, company_id, position
  logger.debug('[AuthService.registerUser] Attempting to register user. Email: %s', email);
  let newUserResponse: Partial<UserAttributes> | undefined;

  try {
    await sequelize.transaction(async (t: any) => { 
      const existingUser = await User.findOne({ where: { email }, transaction: t });
      if (existingUser) {
        logger.warn('[AuthService.registerUser] User with email %s already exists.', email);
        const error = new ApiError('Пользователь с таким email уже существует', 400);
        throw error; 
      }
      const hashedPassword = userData.password_hash; // Предполагается, что хеш уже есть
      const newUser = await User.create({
        ...userData, 
        username: email, 
        password_hash: hashedPassword,
        is_active: true 
      }, { transaction: t });

      const userResponse: Partial<UserAttributes> = { ...newUser.get({ plain: true }) };
      delete userResponse.password_hash;
      newUserResponse = userResponse; 
      logger.info('[AuthService.registerUser] User %s registered successfully within transaction. ID: %s', email, newUser.id);
    });
    return newUserResponse;
  } catch (error: unknown) { 
    const typedError = error as ApiError | Error; 
    if (!(typedError instanceof ApiError)) { 
        logger.error('[AuthService.registerUser] Failed to register user %s. Error: %s', email, typedError.message, { error: typedError, userData });
    }
    throw typedError; 
  }
}

export interface TokenPayloadFromJwt extends JwtPayload {
  id: number;
  role: string;
  email: string;
  client_id?: number | null;
  company_id?: number | null;
}

function verifyToken(token: string): TokenPayloadFromJwt {
  logger.debug('[AuthService.verifyToken] Verifying token.');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === 'string' || !decoded.id || typeof decoded.id !== 'number') { 
      logger.warn('[AuthService.verifyToken] Invalid token structure after decoding.');
      throw new ApiError('Неверная структура токена', 401);
    }
    
    // После проверок TypeScript должен правильно вывести тип, но для явности можно использовать приведение
    const payload = decoded as TokenPayloadFromJwt; 

    logger.info('[AuthService.verifyToken] Token is valid for user ID %s, email %s.', payload.id, payload.email);
    // Возвращаем объект, соответствующий TokenPayloadFromJwt
    return {
      id: payload.id,
      role: payload.role,
      email: payload.email,
      client_id: payload.client_id,
      company_id: payload.company_id,
      // Добавляем стандартные поля JwtPayload, если они нужны далее, или убеждаемся, что они есть в TokenPayloadFromJwt
      iss: payload.iss,
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp,
      nbf: payload.nbf,
      iat: payload.iat,
      jti: payload.jti,
    };
  } catch (err: any) { 
    logger.warn('[AuthService.verifyToken] Invalid or expired token. Error: %s', err.message);
    // Убедимся, что err имеет свойство message. Если нет, передадим стандартное сообщение.
    const errorMessage = (err && err.message) ? err.message : 'Unknown token verification error';
    const error = new ApiError('Неверный или просроченный токен', 401, errorMessage);
    throw error;
  }
}

async function requestPasswordResetForUser(email: string): Promise<boolean> {
  logger.debug('[AuthService.requestPasswordResetForUser] Request for email: %s', email);

  try {
    let emailSent = false; // Флаг для отслеживания отправки email
    await sequelize.transaction(async (t: any) => {
      const user = await User.findOne({ where: { email }, transaction: t });

      if (!user) {
        logger.warn('[AuthService.requestPasswordResetForUser] User with email %s not found during transaction. No token will be saved.', email);
        // Не прерываем транзакцию, просто не будем отправлять email
        return; 
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      user.reset_password_token = hashedToken;
      user.reset_password_expires_at = expiresAt; 
      await user.save({ transaction: t });
      logger.info('[AuthService.requestPasswordResetForUser] Reset token generated and saved for user %s within transaction.', email);
      
      // Логика отправки email теперь внутри транзакции, после сохранения пользователя
      // user здесь точно UserAttributes (или экземпляр User)
      const recipientEmail = user.email;
      // const recipientName = user.full_name || 'Пользователь'; // Пока не используется

      try {
        await emailService.sendPasswordResetEmail(recipientEmail, resetToken); // Передаем оригинальный токен
        logger.info('[AuthService.requestPasswordResetForUser] Password reset email sent to %s from within transaction.', recipientEmail);
        emailSent = true; // Устанавливаем флаг
      } catch (emailError: any) { 
        logger.error('[AuthService.requestPasswordResetForUser] Failed to send password reset email to %s from within transaction. Error: %s', recipientEmail, emailError.message, { error: emailError });
        // Не прерываем транзакцию из-за ошибки email, но emailSent останется false
      }
    }); // Конец транзакции

    // Возвращаем результат на основе флага
    if (emailSent) {
      return true;
    } else {
      logger.info('[AuthService.requestPasswordResetForUser] Email not sent for %s (user not found or email sending failed).', email);
      return false;
    }

  } catch (dbError: any) { 
    logger.error('[AuthService.requestPasswordResetForUser] Database error while processing password reset for %s: %s', email, dbError.message, { error: dbError });
    // Пробрасываем ошибку базы данных, если она произошла вне логики отправки email, но внутри try/catch для транзакции
    // Если ошибка произошла внутри транзакции (например, user.save()), она будет поймана здесь.
    throw dbError; // Или return false, в зависимости от желаемого поведения
  }
}

async function resetUserPassword(token: string, newPassword: string): Promise<boolean> {
  logger.debug('[AuthService.resetUserPassword] Attempting to reset password with token: %s', token);
  let userEmailForNotification: string | null = null;

  try {
    await sequelize.transaction(async (t: any) => {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        where: {
          reset_password_token: hashedToken,
          reset_password_expires_at: { [Op.gt]: new Date() },
        },
        transaction: t
      });

      if (!user) {
        logger.warn('[AuthService.resetUserPassword] Invalid or expired password reset token: %s', token);
        const error = new ApiError('Токен для сброса пароля недействителен или истек.', 400);
        throw error;
      }
      logger.info('[AuthService.resetUserPassword] Valid token for user ID %s. Hashing new password.', user.id);

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password_hash = hashedPassword;
      user.reset_password_token = null;
      user.reset_password_expires_at = null;
      await user.save({ transaction: t });
      
      userEmailForNotification = user.email;
      logger.info('[AuthService.resetUserPassword] Password has been reset successfully for user ID %s within transaction.', user.id);
    });

    if (userEmailForNotification) {
      try {
        // await emailService.sendPasswordChangedEmail(userEmailForNotification, userNameForNotification); // userNameForNotification может быть null
        // logger.info('[AuthService.resetUserPassword] Password changed confirmation email sent to %s.', userEmailForNotification);
      } catch (emailError: any) { 
        logger.error('[AuthService.resetUserPassword] Failed to send password changed confirmation email to %s: %s', 
          userEmailForNotification, emailError.message, { error: emailError });
        // Не критично для основной операции сброса пароля
      }
    }
    logger.info('[AuthService.resetUserPassword] Password reset successfully for token: %s', token);
    return true;
  } catch (error: any) {
    if (error instanceof ApiError) {
      logger.warn('[AuthService.resetUserPassword] API Error during password reset for token %s: %s', token, error.message);
    } else {
      logger.error('[AuthService.resetUserPassword] Database or other error during password reset for token %s: %s', token, error.message, { error });
    }
    return false;
  }
}

// TODO: Реализовать методы сервиса

export default { loginUser, registerUser, verifyToken, requestPasswordResetForUser, resetUserPassword }; 