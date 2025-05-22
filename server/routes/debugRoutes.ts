import { Router, RequestHandler } from 'express';
import * as debugController from '../controllers/debugController.js';
import authMiddleware from '../middlewares/auth.js';

const router = Router();

// Обертка для authMiddleware, чтобы соответствовать RequestHandler и для единообразия
const typedAuthMiddleware: RequestHandler = (req: any, res: any, next: any) => {
  authMiddleware(req, res, next);
};

// Защищаем все маршруты в этом роутере
router.use(typedAuthMiddleware);

// Маршруты для отладочных логов
router.post('/debug-log', debugController.writeLog);
router.get('/debug-log', debugController.getLogs);

router.get('/ping', debugController.ping);

export default router; 