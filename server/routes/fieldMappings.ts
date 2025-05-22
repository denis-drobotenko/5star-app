import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import FieldMappingController from '../controllers/fieldMappingController.js';
import * as XLSXController from '../controllers/xlsxController.js';
import authMiddleware from '../middlewares/auth.js';
import multer from 'multer';
import logger from '../config/logger.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  mappingIdSchema,
  clientIdParamsSchema,  // Новая схема
  createMappingSchema,
  updateMappingSchema,
  uploadSampleSchema,    // Для /upload-sample
  getSignedUrlSchema,    // Для /get-signed-url
} from '../../shared/validators/fieldMappingValidator.js';
import { validateBody as validateXLSXBody, processS3XLSXSchema } from '../../shared/validators/xlsxValidator.js';

// Настройка multer для обработки файлов
const upload = multer({
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
})

// Защищаем все роуты авторизацией
const router = Router();
// router.use('/', authMiddleware as RequestHandler); // Закомментировано

// Обертка для authMiddleware
const typedAuthMiddleware: RequestHandler = (req: any, res: any, next: any) => {
  authMiddleware(req, res, next);
};
router.use('/', typedAuthMiddleware);

// Middleware для логирования всех запросов к этому роутеру
router.use((req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  logger.debug(`[FieldMappingRouter] Received request: ${req.method} ${req.originalUrl}`);
  logger.debug(`[FieldMappingRouter] req.params: ${JSON.stringify(req.params)}`);
  logger.debug(`[FieldMappingRouter] req.query: ${JSON.stringify(req.query)}`);
  next();
});

// ---- Более специфичные маршруты должны идти ПЕРЕД общими маршрутами с параметрами ----

// GET /api/field-mappings/s3-signed-url - получить подписанный URL для доступа к файлу
router.get('/s3-signed-url', validateQuery(getSignedUrlSchema), FieldMappingController.getS3FileSignedUrl);

// GET /field-mappings/client/:clientId - получить маппинги клиента
router.get('/client/:clientId', validateParams(clientIdParamsSchema), FieldMappingController.getByClientId);

// POST /field-mappings/upload-xlsx - загрузить XLSX файл
router.post('/upload-xlsx', upload.single('file'), (req, res, next) => 
  XLSXController.uploadXLSX(req as Request, res, next)
);

// POST /field-mappings/upload-sample - загрузить пример данных в S3
router.post('/upload-sample', upload.single('sampleFile'), validateBody(uploadSampleSchema), FieldMappingController.uploadSample);

// POST /field-mappings/process-s3-xlsx - скачать из S3 и распарсить XLSX файл
router.post(
  '/process-s3-xlsx',
  (req: Request, res: Response, next: NextFunction) => {
    const validationResult = validateXLSXBody(processS3XLSXSchema)(req, res, next);
    if (validationResult === undefined) {
      // next() уже был вызван
    }
  },
  // Обертка для второго обработчика из XLSXController
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Предполагается, что authMiddleware уже добавил req.user
      await (XLSXController.processS3XLSX[1] as any)(req as Request, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// ---- Общие CRUD маршруты ----

// GET /field-mappings - получить все маппинги (нет параметров для валидации)
router.get('/', FieldMappingController.getAll);

// POST /field-mappings - создать новый маппинг
router.post('/', validateBody(createMappingSchema), FieldMappingController.create);

// ---- Маршруты с параметром :id должны идти ПОСЛЕ более специфичных ----

// GET /field-mappings/:id - получить маппинг по ID
router.get('/:id', validateParams(mappingIdSchema), FieldMappingController.getById);

// PUT /field-mappings/:id - обновить маппинг
router.put('/:id', validateParams(mappingIdSchema), validateBody(updateMappingSchema), FieldMappingController.update);

// DELETE /field-mappings/:id - удалить маппинг
router.delete('/:id', validateParams(mappingIdSchema), FieldMappingController.remove);

export default router; 