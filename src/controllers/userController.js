const { User, Client } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

/**
 * Получить всех пользователей. Поддерживает фильтрацию по clientId и userType.
 * @route GET /api/users
 * @group Users - Операции с пользователями
 * @param {integer} [clientId] - ID клиента для фильтрации пользователей (req.query.clientId)
 * @param {string} [userType] - Тип пользователя для фильтрации ('INTERNAL' или 'CLIENT') (req.query.userType)
 * @returns {Array<User>} 200 - Список пользователей
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req, res) {
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
    res.json(users);
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении пользователей' });
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
async function getById(req, res) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    console.error(`Ошибка при получении пользователя ${req.params.id}:`, error);
    res.status(500).json({ message: 'Ошибка сервера при получении пользователя' });
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
async function create(req, res) {
  const {
    email, password, full_name, role, 
    user_type, phone, position, client_id
  } = req.body;

  if (!email || !password || !role || !user_type) {
    return res.status(400).json({ message: 'Пожалуйста, заполните все обязательные поля: email, password, role, user_type' });
  }

  if (user_type === 'CLIENT' && !client_id) {
    return res.status(400).json({ message: 'Для пользователя типа CLIENT необходимо указать client_id' });
  }
  if (user_type === 'INTERNAL' && client_id) {
    // Для внутренних пользователей client_id должен быть null, но мы можем просто его проигнорировать или установить в null
    // В данном случае, если он передан, модель его запишет. Можно добавить логику для установки в null.
  }

  try {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }

    if (user_type === 'CLIENT' && client_id) {
      const client = await Client.findByPk(client_id);
      if (!client) {
        return res.status(400).json({ message: `Клиент с ID ${client_id} не найден` });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      password_hash,
      full_name,
      role,
      user_type,
      phone,
      position: user_type === 'CLIENT' ? position : null,
      client_id: user_type === 'CLIENT' ? client_id : null,
      is_active: true
    });

    const userResponse = { ...newUser.toJSON() };
    delete userResponse.password_hash;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера при создании пользователя' });
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
async function update(req, res) {
  const userId = req.params.id;
  const {
    email, password, full_name, role, 
    user_type, phone, position, client_id, is_active
  } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (email && email !== user.email) {
      const existingEmailOrUsername = await User.findOne({
        where: {
          [Op.or]: [
            { email: email }, 
            { username: email } 
          ],
          id: { [Op.ne]: userId } 
        }
      });

      if (existingEmailOrUsername) {
        return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
      }
      user.email = email;
      user.username = email;
    } else if (email && email !== user.email) {
      return res.status(400).json({ message: 'Имя пользователя (email) должно совпадать с username и не может быть изменено отдельно.' });
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (is_active !== undefined) user.is_active = is_active;

    if (user_type) {
      if (user_type === 'CLIENT') {
        if (client_id !== undefined) {
          if (client_id === null) {
            user.client_id = null;
          } else {
            const client = await Client.findByPk(client_id);
            if (!client) {
              return res.status(400).json({ message: `Клиент с ID ${client_id} не найден` });
            }
            user.client_id = client_id;
          }
        } else if (user.user_type !== 'CLIENT') {
          return res.status(400).json({ message: 'client_id обязателен при смене типа на CLIENT или обновлении пользователя CLIENT, если client_id не был установлен ранее' });
        }
        if (position !== undefined) user.position = position;
      } else if (user_type === 'INTERNAL') {
        user.client_id = null;
        user.position = null;
      }
      user.user_type = user_type;
    } else {
      if (user.user_type === 'CLIENT') {
        if (position !== undefined) user.position = position;
        if (client_id !== undefined) {
          if (client_id === null) {
            user.client_id = null;
          } else {
            const client = await Client.findByPk(client_id);
            if (!client) {
              return res.status(400).json({ message: `Клиент с ID ${client_id} не найден` });
            }
            user.client_id = client_id;
          }
        }
      }
    }

    if (password) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();
    
    const userResponse = { ...user.toJSON() };
    delete userResponse.password_hash;

    res.json(userResponse);
  } catch (error) {
    console.error(`Ошибка при обновлении пользователя ${userId}:`, error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера при обновлении пользователя' });
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
async function remove(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    await user.destroy();
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    console.error(`Ошибка при удалении пользователя ${req.params.id}:`, error);
    res.status(500).json({ message: 'Ошибка сервера при удалении пользователя' });
  }
}

module.exports = { getAll, getById, create, update, remove }; 