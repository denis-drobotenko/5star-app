import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import * as xlsxController from '../controllers/xlsxController.js';
import upload from '../middlewares/upload.js';
import authenticateToken from '../middlewares/auth.js';

const router = Router();

// Обертка для authMiddleware (authenticateToken)
const typedAuthMiddleware: RequestHandler = (req: any, res: any, next: any) => {
  authenticateToken(req, res, next);
};

// Обертка для асинхронных контроллеров
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req as Request, res, next);
    } catch (error) {
      next(error);
    }
};

// Загрузка XLSX файла
router.post(
    '/upload-xlsx', 
    typedAuthMiddleware, 
    upload.single('file'), 
    asyncHandler(xlsxController.uploadXLSX)
);

router.post('/upload', typedAuthMiddleware, asyncHandler(xlsxController.upload));
router.get('/template', typedAuthMiddleware, asyncHandler(xlsxController.getTemplate));

export default router; 