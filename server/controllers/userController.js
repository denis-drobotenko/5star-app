const { User, Client } = require('../../shared/models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const {
  validateBody,
  validateParams,
  validateQuery,
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  getAllUsersSchema,
} = require('../../shared/validators/userValidator');
const userService = require('../services/userService');

/**
 * Получить всех пользователей. Поддерживает фильтрацию по clientId и userType.
 * @route GET /api/users
 * @group Users - Операции с пользователями
 * @param {integer} [clientId] - ID клиента для фильтрации пользователей (req.query.clientId)
 * @param {string} [userType] - Тип пользователя для фильтрации ('INTERNAL' или 'CLIENT') (req.query.userType)
 * @returns {Array<User>} 200 - Список пользователей
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req, res, next) {
  logger.info('[UserController.getAll] Request to get all users. Query params: %o. Requesting user: %o', 
    req.query, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const { clientId, userType } = req.query;
    const whereClause = {};

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
  } catch (error) {
    logger.error('[UserController.getAll] Failed to get all users. Error: %s', error.message, {
      error: error, // Winston извлечет stack, message и т.д.
      requestQuery: req.query,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error); // Передаем ошибку в глобальный обработчик Express
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
async function getById(req, res, next) {
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
    
    // Убедимся, что пароль точно удален перед отправкой
    const userResponse = { ...user.toJSON() };
    delete userResponse.password_hash;

    logger.debug('[UserController.getById] User found and sending response for ID %s: %o', req.params.id, userResponse);
    res.json(userResponse);
  } catch (error) {
    logger.error(`[UserController.getById] Failed to get user by ID ${req.params.id}. Error: ${error.message}`, {
      errorDetails: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      userIdParam: req.params.id,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error); // Передаем ошибку в глобальный обработчик Express
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
async function create(req, res, next) {
  // Маскируем пароль для логирования
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

  // Удалена старая ручная валидация, теперь используется Joi
  // if (!email || !password || !role || !user_type) { ... }
  // if (user_type === 'CLIENT' && !client_id) { ... }

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

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: email, // Используем email как username
      email,
      password_hash,
      full_name,
      role,
      user_type,
      phone: user_type === 'INTERNAL' ? phone : null, // Телефон только для INTERNAL
      position: user_type === 'CLIENT' ? position : null,
      client_id: user_type === 'CLIENT' ? client_id : null,
      is_active: true
    });

    const userResponse = { ...newUser.toJSON() };
    delete userResponse.password_hash;
    logger.debug('[UserController.create] User created successfully with ID %s: %o', newUser.id, userResponse);
    res.status(201).json(userResponse);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      logger.warn('[UserController.create] Sequelize validation error: %s. Errors: %o', error.message, error.errors.map(e => e.message));
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    }
    logger.error('[UserController.create] Failed to create user. Error: %s', error.message, {
      error: error,
      requestBody: bodyToLog, // Логируем тело запроса без пароля
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error); // Передаем ошибку в глобальный обработчик Express
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
async function update(req, res, next) {
  const userId = req.params.id;
  // req.body провалидирован updateUserSchema
  const updateData = req.body;
  const { password, ...bodyToLog } = req.body;

  logger.info('[UserController.update] Attempting to update user ID %s. Body: %o. Requesting user: %o', 
    userId, 
    bodyToLog, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );

  try {
    const updatedUser = await userService.updateUser(userId, updateData);
    logger.info('[UserController.update] User ID %s updated successfully by service.', userId);
    res.json(updatedUser);

  } catch (error) {
    logger.error('[UserController.update] Failed to update user ID %s. Error: %s', userId, error.message, {
      // error: error, // logged by service
      userIdParam: userId,
      requestBody: bodyToLog,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });

    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map(e => e.message).join(', ') : error.message) });
    }
    next(error);
  }
}

/**
 * Удалить пользователя
 * @route DELETE /api/users/:id
 * @group Users - Операции с пользователями
 * @param {integer} id.path.required - ID пользователя
 * @returns {object} 200 - Сообщение об удалении
 * @returns {Error} 404 - Пользователь не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function remove(req, res, next) {
  const userId = req.params.id;
  logger.info('[UserController.remove] Attempting to delete user ID %s. Requesting user: %o',
    userId,
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const success = await userService.deleteUser(userId);
    // Сервис должен выбросить ошибку, если пользователь не найден, 
    // так что success всегда будет true, если не было ошибок.
    // Или можно изменить сервис, чтобы он возвращал объект или null, и проверять здесь.
    // В текущей реализации сервис выбрасывает ошибку 404, если не найден.
    
    logger.debug('[UserController.remove] User ID %s deleted successfully by service.', userId);
    // res.json({ message: 'Пользователь удалён' });
    res.status(204).send(); // Стандартный ответ для успешного удаления без тела

  } catch (error) {
    logger.error('[UserController.remove] Failed to delete user ID %s. Error: %s', userId, error.message, {
      // error: error, // logged by service
      userIdParam: userId,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    // Другие возможные ошибки, например, SequelizeForeignKeyConstraintError, если есть связи
    // if (error.name === 'SequelizeForeignKeyConstraintError') {
    //   return res.status(400).json({ message: 'Невозможно удалить пользователя, так как он связан с другими данными.' });
    // }
    next(error);
  }
}

module.exports = {
  getAll: [validateQuery(getAllUsersSchema), getAll],
  getById: [validateParams(userIdSchema), getById],
  create: [validateBody(createUserSchema), create],
  update: [validateParams(userIdSchema), validateBody(updateUserSchema), update],
  remove: [validateParams(userIdSchema), remove],
}; 