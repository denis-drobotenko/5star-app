import logger from '../config/logger.js';
/**
 * Middleware для проверки роли пользователя
 * @param {string[]} requiredRolesArray - Массив допустимых ролей
 * @returns {Function} Express middleware
 */
export function checkRole(requiredRolesArray) {
    return (req, res, next) => {
        const userExists = !!req.user;
        const roleExists = userExists && !!req.user?.role;
        let roleUpper = null;
        let isIncluded = false;
        if (!Array.isArray(requiredRolesArray)) {
            logger.error('[AuthCheckCritical] requiredRolesArray is NOT an array! Check middleware usage.', { received: requiredRolesArray });
            return res.status(500).json({ message: 'Ошибка конфигурации сервера: неверные параметры для проверки роли' });
        }
        if (roleExists && req.user?.role) {
            roleUpper = req.user.role.toUpperCase().trim();
            isIncluded = requiredRolesArray.map(r => String(r).trim().toUpperCase()).includes(roleUpper);
        }
        if (!userExists || !roleExists || !isIncluded) {
            const userId = userExists && req.user?.id ? req.user.id : 'unknown';
            const userRole = roleExists && req.user?.role ? req.user.role : 'unknown';
            logger.warn(`[Auth] Доступ запрещен для пользователя ID: ${userId} (Роль: ${userRole}). Требуемые роли: ${requiredRolesArray.join(', ')}. Запрос: ${req.method} ${req.originalUrl}`);
            return res.status(403).json({ message: 'Недостаточно прав' });
        }
        next();
    };
}
