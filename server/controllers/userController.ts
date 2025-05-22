import { Request, Response, NextFunction } from 'express';
import { User, Client } from '../../shared/models/index.js';
// import type { UserAttributes } from '../../shared/models/user.js'; // UserAttributes используется для newInstance, но лучше использовать UserCreationAttributes или Partial<UserAttributes>
import bcrypt from 'bcryptjs';
// import { Op } from 'sequelize'; // Не используется
import logger from '../config/logger.js';
// import userService from '../services/userService.js'; // Не используется

/**
 * Получить всех пользователей. Поддерживает фильтрацию по clientId и userType.
 * @route GET /api/users
 * @group Users - Операции с пользователями
 * @param {integer} [clientId] - ID клиента для фильтрации пользователей (req.query.clientId)
 * @param {string} [userType] - Тип пользователя для фильтрации ('INTERNAL' или 'CLIENT') (req.query.userType)
 * @returns {Array<User>} 200 - Список пользователей
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req: Request, res: Response, next: NextFunction) {
  logger.info('[UserController.getAll] Request to get all users. Query params: %o. Requesting user: %o', 
    req.query, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const { clientId, userType } = req.query as { clientId?: string, userType?: string };
    const whereClause: any = {};

    if (clientId) {
      whereClause.client_id = clientId;
    }
    if (userType) {
      whereClause.user_type = userType;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    logger.debug('[UserController.getAll] Found %d users. Sending response.', users.length);
    res.status(200).json(users);
  } catch (error: any) {
    logger.error('[UserController.getAll] Failed to get all users. Error: %s', error.message, {
      error: error,
      requestQuery: req.query,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Получить пользователя по ID
 * @route GET /api/users/:id
 * @group Users - Операции с пользователями
 * @param {integer} id.path.required - ID пользователя
 * @returns {User} 200 - Данные пользователя
 * @returns {Error} 404 - Пользователь не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function getById(req: Request, res: Response, next: NextFunction) {
  logger.info(`[UserController.getById] Request to get user by ID: ${req.params.id}. Requesting user: %o`, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    if (!user) {
      logger.warn(`[UserController.getById] User not found for ID: ${req.params.id}`);
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const userResponse = { ...user.toJSON() };

    logger.debug('[UserController.getById] User found and sending response for ID %s: %o', req.params.id, userResponse);
    res.json(userResponse);
  } catch (error: any) {
    logger.error(`[UserController.getById] Failed to get user by ID ${req.params.id}. Error: ${error.message}`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    next(error);
  }
}

/**
 * Создать нового пользователя
 * @route POST /api/users
 * @group Users - Операции с пользователями
 * @param {string} email.body.required - Email (также будет использоваться как username)
 * @param {string} password.body.required - Пароль
 * @param {string} [full_name.body] - ФИО
 * @param {string} role.body.required - Роль пользователя (для INTERNAL: 'ADMIN', 'ANALYST', 'MODERATOR'; для CLIENT: 'CLIENT_CONTACT')
 * @param {string} user_type.body.required - Тип пользователя ('INTERNAL' или 'CLIENT')
 * @param {string} [phone.body] - Телефон (для INTERNAL)
 * @param {string} [position.body] - Должность (для CLIENT user_type)
 * @param {integer} [client_id.body] - ID клиента (обязательно для user_type='CLIENT')
 * @param {string} [username.body] - **DEPRECATED:** Используйте поле email. Это поле будет заполнено значением из email.
 * @returns {User} 201 - Созданный пользователь
 * @returns {Error} 400 - Некорректные данные или пользователь уже существует
 * @returns {Error} 500 - Ошибка сервера
 */
async function create(req: Request, res: Response, next: NextFunction) {
  const { password, ...bodyToLog } = req.body;
  logger.info('[UserController.create] Attempting to create user. Body: %o. Requesting user: %o', 
    bodyToLog, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );

  const {
    email,
    full_name, role, 
    user_type, phone, position, client_id
  } = req.body;

  try {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      logger.warn('[UserController.create] User with email %s already exists.', email);
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }

    if (user_type === 'CLIENT' && client_id) {
      const client = await Client.findByPk(client_id);
      if (!client) {
        logger.warn('[UserController.create] Client with ID %s not found for CLIENT user type.', client_id);
        return res.status(400).json({ message: `Клиент с ID ${client_id} не найден` });
      }
    }

    const password_hash = await bcrypt.hash(req.body.password, 10);
    const newUser = await User.create({
      username: email,
      email,
      password_hash,
      full_name,
      role,
      user_type,
      phone: user_type === 'INTERNAL' ? phone : null,
      position: user_type === 'CLIENT' ? position : null,
      client_id: user_type === 'CLIENT' ? client_id : null,
      is_active: true
    });

    const userResponse = { ...newUser.toJSON() };
    logger.debug('[UserController.create] User created successfully with ID %s: %o', newUser.id, userResponse);
    res.status(201).json(userResponse);
  } catch (error: any) {
    if (error.name === 'SequelizeValidationError') {
      logger.warn('[UserController.create] Sequelize validation error: %s. Errors: %o', error.message, error.errors.map((e: any) => e.message));
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map((e: any) => e.message).join(', ') });
    }
    logger.error('[UserController.create] Failed to create user. Error: %s', error.message, {
      error: error,
      requestBody: bodyToLog,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Обновить пользователя
 * @route PUT /api/users/:id
 * @group Users - Операции с пользователями
 * @param {integer} id.path.required - ID пользователя
 * @param {string} [email.body] - Email (изменение email также изменит username)
 * @param {string} [password.body] - Новый пароль
 * @param {string} [full_name.body] - ФИО
 * @param {string} [role.body] - Роль пользователя (для INTERNAL: 'ADMIN', 'ANALYST', 'MODERATOR'; для CLIENT: 'CLIENT_CONTACT')
 * @param {string} [user_type.body] - Тип пользователя ('INTERNAL' или 'CLIENT')
 * @param {string} [phone.body] - Телефон (для INTERNAL)
 * @param {string} [position.body] - Должность (для CLIENT)
 * @param {integer} [client_id.body] - ID клиента (если user_type='CLIENT')
 * @param {boolean} [is_active.body] - Статус активности
 * @param {string} [username.body] - **DEPRECATED:** Используйте поле email. Username обновляется автоматически при изменении email.
 * @returns {User} 200 - Обновлённый пользователь
 * @returns {Error} 400 - Некорректные данные
 * @returns {Error} 404 - Пользователь не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function update(req: Request, res: Response, next: NextFunction) {
  const userId = req.params.id;
  const updateData = req.body;
  const { password, ...bodyToLog } = req.body;

  logger.info('[UserController.update] Attempting to update user ID %s. Body: %o. Requesting user: %o', 
    userId, 
    bodyToLog,
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      logger.warn(`[UserController.update] User not found for ID: ${userId}`);
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (updateData.email && updateData.email !== user.email) {
      updateData.username = updateData.email;
    }

    if (updateData.password) {
      updateData.password_hash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }

    if (updateData.user_type === 'CLIENT' && updateData.client_id) {
      const client = await Client.findByPk(updateData.client_id);
      if (!client) {
        logger.warn(`[UserController.update] Client with ID ${updateData.client_id} not found for user ${userId}`);
        return res.status(400).json({ message: `Клиент с ID ${updateData.client_id} не найден` });
      }
    } else if (updateData.user_type === 'INTERNAL') {
      updateData.client_id = null;
      updateData.position = null;
    } else if (updateData.user_type === 'CLIENT' && !updateData.client_id && !user.client_id) {
      logger.warn(`[UserController.update] client_id is required for user_type CLIENT for user ${userId}`);
      return res.status(400).json({ message: 'client_id обязателен для типа пользователя CLIENT' });
    }

    await user.update(updateData);
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    
    if (!updatedUser) {
        logger.error(`[UserController.update] User ID ${userId} not found after update. This should not happen.`);
        return res.status(404).json({ message: 'Пользователь не найден после обновления' });
    }

    const userResponse = { ...updatedUser.toJSON() };

    logger.debug(`[UserController.update] User ID ${userId} updated successfully. Response: %o`, userResponse);
    res.json(userResponse);
  } catch (error: any) {
    if (error.name === 'SequelizeValidationError') {
      logger.warn('[UserController.update] Sequelize validation error for user ID %s: %s. Errors: %o', userId, error.message, error.errors.map((e: any) => e.message));
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map((e: any) => e.message).join(', ') });
    }
    logger.error(`[UserController.update] Failed to update user ID ${userId}. Error: ${error.message}`, {
      error: error,
      requestBody: bodyToLog,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Удалить пользователя
 * @route DELETE /api/users/:id
 * @group Users - Операции с пользователями
 * @param {integer} id.path.required - ID пользователя
 * @returns {object} 200 - Сообщение об успешном удалении
 * @returns {Error} 404 - Пользователь не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function remove(req: Request, res: Response, next: NextFunction) {
  const userId = req.params.id;
  logger.info('[UserController.remove] Attempting to delete user ID %s. Requesting user: %o', 
    userId, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      logger.warn(`[UserController.remove] User not found for ID: ${userId}`);
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    await user.destroy();
    logger.debug(`[UserController.remove] User ID ${userId} deleted successfully.`);
    res.json({ message: 'Пользователь успешно удален' });
  } catch (error: any) {
    logger.error(`[UserController.remove] Failed to delete user ID ${userId}. Error: ${error.message}`, {
      error: error,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

export {
  getAll,
  getById,
  create,
  update,
  remove
}; 