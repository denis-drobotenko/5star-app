import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import auth from '../middlewares/auth.js';
import { checkRole } from '../middlewares/roles.js';
import { validateBody, validateParams, validateQuery, createUserSchema, updateUserSchema, userIdSchema, getAllUsersSchema } from '../../shared/validators/userValidator.js';
const router = Router();
// Обертка для authMiddleware
const typedAuthMiddleware = (req, res, next) => {
    auth(req, res, next);
};
// Обертка для checkRole, чтобы соответствовать RequestHandler
const typedCheckRoleAdmin = (req, res, next) => {
    // Вызываем оригинальный checkRole. Он либо вызовет next(), либо отправит ответ.
    const checkRoleMiddleware = checkRole(['ADMIN']);
    checkRoleMiddleware(req, res, next);
    // Если checkRoleMiddleware отправил ответ, то дальше цепочка не пойдет.
    // Если он вызвал next(), то все хорошо.
};
// Применяем обернутый auth и checkRole ко всем путям, начиная с '/'
router.use('/', typedAuthMiddleware, typedCheckRoleAdmin);
// Обертка для асинхронных контроллеров, чтобы они соответствовали RequestHandler
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        // req здесь обычный Request, но fn ожидает AuthenticatedRequest.
        // typedAuthMiddleware должен был уже добавить req.user.
        await fn(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
router.get('/', validateQuery(getAllUsersSchema), asyncHandler(userController.getAll));
router.get('/:id', validateParams(userIdSchema), asyncHandler(userController.getById));
router.post('/', validateBody(createUserSchema), asyncHandler(userController.create));
router.put('/:id', validateParams(userIdSchema), validateBody(updateUserSchema), asyncHandler(userController.update));
router.delete('/:id', validateParams(userIdSchema), asyncHandler(userController.remove));
export default router;
