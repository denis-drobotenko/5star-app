const { User, Client, sequelize, Op } = require('../../shared/models');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
class ApiError extends Error {
    constructor(message, status, originalError) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.status = status;
        this.originalError = originalError;
    }
}
// ... существующий код getAllUsers ...
async function getAllUsers(filters = {}) {
    const { clientId, userType } = filters;
    logger.debug('[UserService.getAllUsers] Fetching users with filters: %o', filters);
    try {
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
        logger.info(`[UserService.getAllUsers] Successfully fetched ${users.length} users.`);
        return users;
    }
    catch (error) {
        logger.error('[UserService.getAllUsers] Error fetching users: %s', error.message, { error, filters });
        throw error;
    }
}
async function getUserById(userId) {
    logger.debug('[UserService.getUserById] Fetching user by ID: %s', userId);
    try {
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password_hash'] },
            include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
        });
        if (!user) {
            logger.warn('[UserService.getUserById] User not found for ID: %s', userId);
            return null; // Контроллер вернет 404
        }
        // Пароль уже исключен запросом, но для полной уверенности (если вдруг запрос изменится)
        const userResponse = { ...user.toJSON() };
        delete userResponse.password_hash;
        logger.info('[UserService.getUserById] Successfully fetched user ID: %s', userId);
        return userResponse;
    }
    catch (error) {
        logger.error('[UserService.getUserById] Error fetching user ID %s: %s', userId, error.message, { error });
        throw error;
    }
}
async function createUser(userData) {
    const { email, password, full_name, role, user_type, phone, position, client_id } = userData;
    logger.debug('[UserService.createUser] Attempting to create user. Email: %s, Role: %s, Type: %s', email, role, user_type);
    let newUserResponse;
    try {
        await sequelize.transaction(async (t) => {
            const existingEmail = await User.findOne({ where: { email }, transaction: t });
            if (existingEmail) {
                logger.warn('[UserService.createUser] User with email %s already exists.', email);
                throw new ApiError('Пользователь с таким email уже существует', 400);
            }
            if (user_type === 'CLIENT') {
                if (!client_id) {
                    logger.warn('[UserService.createUser] client_id is required for CLIENT user type.');
                    throw new ApiError('Для пользователя типа CLIENT необходимо указать client_id', 400);
                }
                const client = await Client.findByPk(client_id, { transaction: t });
                if (!client) {
                    logger.warn('[UserService.createUser] Client with ID %s not found for CLIENT user type.', client_id);
                    throw new ApiError(`Клиент с ID ${client_id} не найден`, 400);
                }
            }
            else if (client_id) {
                // Если указан client_id, но тип не CLIENT - это ошибка
                logger.warn('[UserService.createUser] client_id %s provided for non-CLIENT user type %s.', client_id, user_type);
                throw new ApiError(`Нельзя указать client_id для пользователя типа ${user_type}`, 400);
            }
            const password_hash = await bcrypt.hash(password, 10);
            const newUserPayload = {
                username: email, // Используем email как username
                email,
                password_hash,
                full_name,
                role,
                user_type,
                // Устанавливаем поля phone/position/client_id только если они применимы к типу пользователя
                phone: user_type === 'INTERNAL' ? phone : null,
                position: user_type === 'CLIENT' ? position : null,
                client_id: user_type === 'CLIENT' ? client_id : null,
                is_active: true
            };
            const newUser = await User.create(newUserPayload, { transaction: t });
            // Получаем пользователя с клиентом, если он есть, для консистентного ответа
            const createdUser = await User.findByPk(newUser.id, {
                attributes: { exclude: ['password_hash'] },
                include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
                transaction: t
            });
            newUserResponse = createdUser.toJSON();
            logger.info('[UserService.createUser] User created successfully with ID %s within transaction', newUser.id);
        });
        return newUserResponse;
    }
    catch (error) {
        if (!error.status) {
            logger.error('[UserService.createUser] Failed to create user. Email: %s. Error: %s', email, error.message, { error, userData });
        }
        throw error;
    }
}
async function updateUser(userId, updateData) {
    const { email, password, client_id, user_type, ...otherData } = updateData;
    logger.debug('[UserService.updateUser] Attempting to update user ID: %s. Data: %o', userId, updateData);
    let updatedUserResponse;
    try {
        await sequelize.transaction(async (t) => {
            const user = await User.findByPk(userId, { transaction: t });
            if (!user) {
                logger.warn('[UserService.updateUser] User not found for ID: %s', userId);
                throw new ApiError('Пользователь не найден', 404);
            }
            const dataToUpdate = { ...otherData }; // Начинаем с otherData, чтобы не затереть email/password/client_id/user_type если они там есть и не переданы отдельно
            if (email && email !== user.email) {
                const existingEmail = await User.findOne({
                    where: { email, id: { [Op.ne]: userId } },
                    transaction: t
                });
                if (existingEmail) {
                    logger.warn('[UserService.updateUser] New email %s already exists for another user.', email);
                    throw new ApiError('Пользователь с таким email уже существует', 400);
                }
                dataToUpdate.email = email;
                dataToUpdate.username = email; // Обновляем username вместе с email
            }
            if (password) {
                dataToUpdate.password_hash = await bcrypt.hash(password, 10);
            }
            // Определяем финальный user_type и client_id
            const finalUserType = user_type !== undefined ? user_type : user.user_type;
            dataToUpdate.user_type = finalUserType;
            let finalClientId = client_id !== undefined ? client_id : user.client_id;
            if (finalUserType === 'CLIENT') {
                if (finalClientId === null || finalClientId === undefined) { // Если тип CLIENT, client_id должен быть
                    logger.warn('[UserService.updateUser] client_id is required for user type CLIENT. User ID: %s', userId);
                    throw new ApiError('Для пользователя типа CLIENT необходимо указать client_id', 400);
                }
                const client = await Client.findByPk(finalClientId, { transaction: t });
                if (!client) {
                    logger.warn('[UserService.updateUser] Client with ID %s not found. User ID: %s', finalClientId, userId);
                    throw new ApiError(`Клиент с ID ${finalClientId} не найден`, 400);
                }
                dataToUpdate.client_id = finalClientId;
                // Обнуляем поля, специфичные для INTERNAL, если тип меняется на CLIENT или уже CLIENT
                dataToUpdate.phone = null; // Если phone есть в otherData, он перезапишется ниже, если user_type останется INTERNAL
            }
            else if (finalUserType === 'INTERNAL') {
                dataToUpdate.client_id = null;
                dataToUpdate.position = null;
                // phone и position из otherData будут применены, если они там есть
            }
            // Применяем otherData после логики user_type/client_id, чтобы они могли перезаписать phone/position при необходимости
            // Но нужно убедиться, что phone/position не применяются для неправильного типа
            if (finalUserType === 'CLIENT' && otherData.hasOwnProperty('phone')) {
                delete dataToUpdate.phone; // Удаляем phone, если он пришел в otherData для CLIENT типа
            }
            if (finalUserType === 'INTERNAL' && otherData.hasOwnProperty('position')) {
                delete dataToUpdate.position; // Удаляем position, если он пришел в otherData для INTERNAL типа
            }
            await user.update(dataToUpdate, { transaction: t });
            const updatedUser = await User.findByPk(userId, {
                attributes: { exclude: ['password_hash'] },
                include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
                transaction: t
            });
            updatedUserResponse = updatedUser.toJSON();
            logger.info('[UserService.updateUser] User ID %s updated successfully within transaction.', userId);
        });
        return updatedUserResponse;
    }
    catch (error) {
        if (!error.status) {
            logger.error('[UserService.updateUser] Failed to update user ID %s. Error: %s', userId, error.message, { error, updateData });
        }
        throw error;
    }
}
async function deleteUser(userId) {
    logger.debug('[UserService.deleteUser] Attempting to delete user ID: %s', userId);
    try {
        await sequelize.transaction(async (t) => {
            const user = await User.findByPk(userId, { transaction: t });
            if (!user) {
                logger.warn('[UserService.deleteUser] User not found for ID: %s', userId);
                throw new ApiError('Пользователь не найден', 404);
            }
            // TODO: Добавить проверки на связанные сущности, если это требуется (например, активные задачи)
            // Пока что просто удаляем пользователя
            await user.destroy({ transaction: t });
            logger.info('[UserService.deleteUser] User ID: %s deleted successfully within transaction.', userId);
        });
        return true; // Успешное удаление
    }
    catch (error) {
        if (!error.status) {
            logger.error('[UserService.deleteUser] Failed to delete user ID %s. Error: %s', userId, error.message, { error });
        }
        throw error;
    }
}
export default {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
};
