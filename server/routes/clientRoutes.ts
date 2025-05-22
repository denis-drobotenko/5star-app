import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import * as clientController from '../controllers/clientController.js';
import authMiddleware from '../middlewares/auth.js'; // Заменили require
import { checkRole } from '../middlewares/roles.js';  // Заменили require и импортировали checkRole
import upload from '../middlewares/upload.js';       // Заменили require
// TODO: Добавить импорт валидаторов, если они нужны для clientRoutes

const router = Router();

// Обертка для authMiddleware (если используется одно и то же)
const typedAuthMiddleware: RequestHandler = (req: any, res: any, next: any) => {
  authMiddleware(req, res, next);
};

// Обертка для checkRole, чтобы соответствовать RequestHandler
const typedCheckRole = (roles: string[]): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const checkRoleMiddleware = checkRole(roles);
  checkRoleMiddleware(req, res, next);
};

// Обертка для асинхронных контроллеров
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res, next); // Убрал as Request, так как fn теперь ожидает Request
    } catch (error) {
      next(error);
    }
};

// Маршруты для клиентов
router.get(
    '/', 
    typedAuthMiddleware, 
    asyncHandler(clientController.getAll)
); 

router.post(
    '/', 
    typedAuthMiddleware, 
    typedCheckRole(['ADMIN', 'MANAGER']), 
    upload.single('logoFile'), 
    asyncHandler(clientController.create)
); 

router.get(
    '/:id', 
    typedAuthMiddleware, 
    asyncHandler(clientController.getById)
); 

router.put(
    '/:id', 
    typedAuthMiddleware, 
    typedCheckRole(['ADMIN', 'MANAGER']), 
    upload.single('logoFile'), 
    asyncHandler(clientController.update)
); 

router.delete(
    '/:id', 
    typedAuthMiddleware, 
    typedCheckRole(['ADMIN', 'MANAGER']), 
    asyncHandler(clientController.remove)
); 

export default router; 