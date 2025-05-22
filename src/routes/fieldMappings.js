const express = require('express')
const router = express.Router()
const FieldMappingController = require('../controllers/fieldMappingController')
const XLSXController = require('../controllers/xlsxController')
const authMiddleware = require('../middlewares/auth')
const multer = require('multer')
const logger = require('../config/logger')
const {
  validateBody,
  validateParams,
  validateQuery,
  mappingIdSchema,
  clientIdParamsSchema,  // Новая схема
  createMappingSchema,
  updateMappingSchema,
  uploadSampleSchema,    // Для /upload-sample
  getSignedUrlSchema,    // Для /get-signed-url
} = require('../middlewares/validators/fieldMappingValidator');
const { validateBody: validateXLSXBody, processS3XLSXSchema } = require('../middlewares/validators/xlsxValidator');

// Настройка multer для обработки файлов
const upload = multer({
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
})

// Защищаем все роуты авторизацией
router.use(authMiddleware)

// Middleware для логирования всех запросов к этому роутеру
router.use((req, res, next) => {
  logger.debug(`[FieldMappingRouter] Received request: ${req.method} ${req.originalUrl}`);
  logger.debug(`[FieldMappingRouter] req.params: ${JSON.stringify(req.params)}`);
  logger.debug(`[FieldMappingRouter] req.query: ${JSON.stringify(req.query)}`);
  next();
});

// ---- Более специфичные маршруты должны идти ПЕРЕД общими маршрутами с параметрами ----

// GET /api/field-mappings/s3-signed-url - получить подписанный URL для доступа к файлу
router.get('/s3-signed-url', validateQuery(getSignedUrlSchema), FieldMappingController.getS3FileSignedUrl)

// GET /field-mappings/client/:clientId - получить маппинги клиента
router.get('/client/:clientId', validateParams(clientIdParamsSchema), FieldMappingController.getByClientId)

// POST /field-mappings/upload-xlsx - загрузить XLSX файл
router.post('/upload-xlsx', upload.single('file'), XLSXController.uploadXLSX)

// POST /field-mappings/upload-sample - загрузить пример данных в S3
router.post('/upload-sample', upload.single('sampleFile'), validateBody(uploadSampleSchema), FieldMappingController.uploadSample)

// POST /field-mappings/process-s3-xlsx - скачать из S3 и распарсить XLSX файл
router.post('/process-s3-xlsx', validateXLSXBody(processS3XLSXSchema), XLSXController.processS3XLSX)

// ---- Общие CRUD маршруты ----

// GET /field-mappings - получить все маппинги (нет параметров для валидации)
router.get('/', FieldMappingController.getAll)

// POST /field-mappings - создать новый маппинг
router.post('/', validateBody(createMappingSchema), FieldMappingController.create)

// ---- Маршруты с параметром :id должны идти ПОСЛЕ более специфичных ----

// GET /field-mappings/:id - получить маппинг по ID
router.get('/:id', validateParams(mappingIdSchema), FieldMappingController.getById)

// PUT /field-mappings/:id - обновить маппинг
router.put('/:id', validateParams(mappingIdSchema), validateBody(updateMappingSchema), FieldMappingController.update)

// DELETE /field-mappings/:id - удалить маппинг
router.delete('/:id', validateParams(mappingIdSchema), FieldMappingController.delete)

module.exports = router 