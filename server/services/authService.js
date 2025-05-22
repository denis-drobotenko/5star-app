const { User, Company, sequelize } = require('../../shared/models'); // sequelize для транзакций, если понадобится
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../config/logger');
const emailService = require('./emailService'); // Предполагаем, что emailService уже есть или будет создан

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

async function loginUser(email, password) {
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
    const error = new Error('Неверный email или пароль');
    error.status = 401;
    throw error;
  }
  logger.debug('[AuthService.loginUser] User %s found. ID: %s. Comparing password.', email, user.id);

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    logger.warn('[AuthService.loginUser] Invalid password for user %s.', email);
    const error = new Error('Неверный email или пароль');
    error.status = 401;
    throw error;
  }
  logger.debug('[AuthService.loginUser] Password for %s is correct. Generating JWT.', email);

  const tokenPayload = {
    id: user.id,
    role: user.role,
    email: user.email,
    client_id: user.client_id,
    company_id: user.company_id
  };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

  const userResponse = { ...user.toJSON() };
  delete userResponse.password_hash;

  logger.info('[AuthService.loginUser] JWT for %s generated.', email);
  return { token, user: userResponse };
}

async function registerUser(userData) {
  const { email, password, fullName, role, user_type, client_id, company_id, position } = userData;
  logger.debug('[AuthService.registerUser] Attempting to register user. Email: %s', email);
  let newUserResponse;

  try {
    await sequelize.transaction(async (t) => {
      const existingUser = await User.findOne({ where: { email }, transaction: t });
      if (existingUser) {
        logger.warn('[AuthService.registerUser] User with email %s already exists.', email);
        const error = new Error('Пользователь с таким email уже существует');
        error.status = 400;
        throw error; // Ошибка будет перехвачена внешним catch и транзакция откатится
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        email,
        username: email, // Используем email как username по умолчанию
        password_hash: hashedPassword,
        full_name: fullName,
        role,
        user_type,
        client_id, 
        company_id,
        position,
        is_active: true // По умолчанию активен
      }, { transaction: t });

      const userResponse = { ...newUser.toJSON() };
      delete userResponse.password_hash;
      newUserResponse = userResponse; // Присваиваем для возврата из функции
      logger.info('[AuthService.registerUser] User %s registered successfully within transaction. ID: %s', email, newUser.id);
    });
    return newUserResponse;
  } catch (error) {
    // Логируем ошибку, если она не была обработана ранее (например, ошибка валидации Sequelize)
    if (!error.status) { // Если это не наша кастомная ошибка со статусом
        logger.error('[AuthService.registerUser] Failed to register user %s. Error: %s', email, error.message, { error, userData });
    }
    throw error; // Перебрасываем ошибку дальше
  }
}

function verifyToken(token) {
  logger.debug('[AuthService.verifyToken] Verifying token.');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    logger.info('[AuthService.verifyToken] Token is valid for user ID %s, email %s.', payload.id, payload.email);
    return {
      id: payload.id,
      role: payload.role,
      email: payload.email,
      client_id: payload.client_id,
      company_id: payload.company_id
    };
  } catch (err) {
    logger.warn('[AuthService.verifyToken] Invalid or expired token. Error: %s', err.message);
    const error = new Error('Неверный или просроченный токен');
    error.status = 401;
    error.originalError = err.message;
    throw error;
  }
}

async function requestPasswordResetForUser(email, resetUrlBase) {
  logger.debug('[AuthService.requestPasswordResetForUser] Request for email: %s', email);
  let userForEmail;
  let resetTokenForEmail;

  try {
    await sequelize.transaction(async (t) => {
      const user = await User.findOne({ where: { email }, transaction: t });

      if (!user) {
        logger.warn('[AuthService.requestPasswordResetForUser] User with email %s not found during transaction. No token will be saved.', email);
        // Не бросаем ошибку, чтобы не раскрывать существование email, просто не будем ничего делать
        return; 
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      user.reset_password_token = hashedToken;
      user.reset_password_expires = expiresAt;
      await user.save({ transaction: t });
      logger.info('[AuthService.requestPasswordResetForUser] Reset token generated and saved for user %s within transaction.', email);
      
      userForEmail = user; // Сохраняем для отправки email после транзакции
      resetTokenForEmail = resetToken; // Сохраняем оригинальный токен для ссылки
    });

    if (!userForEmail) {
      // Пользователь не был найден в транзакции, выходим
      return false;
    }

    const resetLink = `${resetUrlBase}${resetTokenForEmail}`;
    
    try {
      await emailService.sendPasswordResetEmail(userForEmail.email, userForEmail.full_name, resetLink);
      logger.info('[AuthService.requestPasswordResetForUser] Password reset email sent to %s.', userForEmail.email);
      return true;
    } catch (emailError) {
      logger.error('[AuthService.requestPasswordResetForUser] Failed to send password reset email to %s after DB transaction. Error: %s', userForEmail.email, emailError.message, { error: emailError });
      // Здесь важно: токен уже сохранен. Ошибка отправки email не должна откатывать это.
      // Можно добавить флаг в user запись, что email не был отправлен, или повторную попытку.
      // Пока что просто логируем и возвращаем false, так как основная цель (отправка email) не достигнута.
      return false; 
    }

  } catch (dbError) {
    logger.error('[AuthService.requestPasswordResetForUser] Database error while processing password reset for %s: %s', email, dbError.message, { error: dbError });
    // Не возвращаем true/false, а пробрасываем ошибку, чтобы контроллер вернул 500
    throw dbError;
  }
}

async function resetUserPassword(token, newPassword) {
  logger.debug('[AuthService.resetUserPassword] Attempting to reset password with token (first 8 chars): %s', token.substring(0,8));
  let userEmailForNotification;
  let userNameForNotification;
  try {
    await sequelize.transaction(async (t) => {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        where: {
          reset_password_token: hashedToken,
          reset_password_expires: { [Op.gt]: new Date() },
        },
        transaction: t
      });

      if (!user) {
        logger.warn('[AuthService.resetUserPassword] Invalid or expired password reset token (first 8 chars): %s', token.substring(0,8));
        const error = new Error('Токен для сброса пароля недействителен или истек.');
        error.status = 400;
        throw error;
      }
      logger.info('[AuthService.resetUserPassword] Valid token for user ID %s. Hashing new password.', user.id);

      user.password_hash = await bcrypt.hash(newPassword, 10);
      user.reset_password_token = null;
      user.reset_password_expires = null;
      await user.save({ transaction: t });
      
      userEmailForNotification = user.email;
      userNameForNotification = user.full_name;
      logger.info('[AuthService.resetUserPassword] Password has been reset successfully for user ID %s within transaction.', user.id);
    });

    // Отправляем email об успешном сбросе пароля после транзакции
    if (userEmailForNotification) {
        try {
            await emailService.sendPasswordChangedEmail(userEmailForNotification, userNameForNotification);
            logger.info('[AuthService.resetUserPassword] Password changed confirmation email sent to %s.', userEmailForNotification);
        } catch (emailError) {
            logger.error('[AuthService.resetUserPassword] Failed to send password changed confirmation email to %s. Error: %s', userEmailForNotification, emailError.message, {error: emailError});
            // Не критично, основной процесс завершен
        }
    }
    return true; // Сигнализирует об успехе
  } catch (error) {
    if (!error.status) { // Если это не наша кастомная ошибка со статусом
        logger.error('[AuthService.resetUserPassword] Failed to reset password for token %s (first 8 chars). Error: %s', token.substring(0,8), error.message, { error });
    }
    throw error;
  }
}

// TODO: Реализовать методы сервиса

module.exports = {
  loginUser,
  registerUser,
  verifyToken,
  requestPasswordResetForUser,
  resetUserPassword,
}; 