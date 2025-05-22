import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { ParsedQs } from 'qs';
import * as importController from '../controllers/importController.js';
import authMiddleware from '../middlewares/auth.js';
import logger from '../config/logger.js';
// import { AuthenticatedRequest } from '../types/express/index.js'; // Больше не используется
const router = Router();

// Обертка для authMiddleware
const typedAuthMiddleware: RequestHandler = (req: any, res: any, next: any) => {
  authMiddleware(req, res, next);
};
router.use('/', typedAuthMiddleware); // Применяем ко всем роутам

// Получить все истории загрузок (с фильтрацией и пагинацией)
// GET /api/imports?companyId=1&page=1&limit=10&sortBy=created_at&sortOrder=DESC
router.get('/', async (req, res, next) => {
  try {
    await importController.getAllImports(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Инициировать новую загрузку (создать запись в ImportHistory)
// POST /api/imports/initiate
router.post('/initiate', async (req, res, next) => {
  try {
    await importController.initiateImport(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Загрузить файл для существующей записи ImportHistory, обработать и вернуть превью
// POST /api/imports/:importId/upload-file
router.post('/:importId/upload-file', async (req, res, next) => {
  try {
    // importController.uploadAndProcessFile это массив middleware
    if (Array.isArray(importController.uploadAndProcessFile) && importController.uploadAndProcessFile.length > 0) {
      const multerRunner = importController.uploadAndProcessFile[0] as RequestHandler; // Первый элемент - multer middleware
      
      multerRunner(req, res, async (multerError?: any) => {
        if (multerError) {
          return next(multerError);
        }
        // После успешного выполнения multer, req.file должен быть доступен.
        // Теперь вызываем второй (основной) обработчик, если он есть.
        if (importController.uploadAndProcessFile.length > 1) {
          // Указываем, что req в mainFileHandler будет иметь params
          const mainFileHandler = importController.uploadAndProcessFile[1] as 
            (req: Request<{ importId: string }, any, any, ParsedQs>, res: Response, next: NextFunction) => Promise<void>; 
          await mainFileHandler(req, res, next); // req здесь уже Request<{ importId: string }, ...>
        } else {
          // Этого не должно произойти, если importController.uploadAndProcessFile правильно определен
          next();
        }
      });
    } else {
      logger.error('[ImportRoutes] uploadAndProcessFile is not configured as an array of middleware.');
      next(new Error('Server configuration error for file upload.'));
    }
  } catch (error) {
    next(error);
  }
});

// Выполнить окончательную загрузку данных из файла (связанного с ImportHistory) в таблицу orders
// POST /api/imports/:importId/execute
router.post('/:importId/execute', async (req, res, next) => {
  try {
    await importController.executeImport(req, res, next);
  } catch (error) {
    next(error);
  }
});

// TODO: Возможно, понадобятся еще роуты:
// - GET /api/imports/:id - получить одну запись ImportHistory по ID
// - DELETE /api/imports/:id - удалить запись ImportHistory (и, возможно, файл из S3)
// - PUT /api/imports/:id - обновить какую-то информацию в ImportHistory (например, custom_name)

export default router; 