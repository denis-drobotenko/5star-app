const express = require('express')
const router = express.Router()
const FieldMappingController = require('../controllers/fieldMappingController')
const XLSXController = require('../controllers/xlsxController')
const authMiddleware = require('../middlewares/auth')
const multer = require('multer')

// Настройка multer для обработки файлов
const upload = multer({
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
})

// Защищаем все роуты авторизацией
router.use(authMiddleware)

// GET /field-mappings - получить все маппинги
router.get('/', FieldMappingController.getAll)

// GET /field-mappings/company/:companyId - получить маппинги компании
router.get('/company/:companyId', FieldMappingController.getByCompanyId)

// GET /field-mappings/:id - получить маппинг по ID
router.get('/:id', FieldMappingController.getById)

// POST /field-mappings - создать новый маппинг
router.post('/', FieldMappingController.create)

// PUT /field-mappings/:id - обновить маппинг
router.put('/:id', FieldMappingController.update)

// DELETE /field-mappings/:id - удалить маппинг
router.delete('/:id', FieldMappingController.delete)

// POST /field-mappings/upload-xlsx - загрузить XLSX файл
router.post('/upload-xlsx', upload.single('file'), XLSXController.uploadXLSX)

// POST /field-mappings/upload-sample - загрузить пример данных в S3
router.post('/upload-sample', FieldMappingController.uploadSample)

// GET /field-mappings/get-signed-url - получить подписанный URL для доступа к файлу
router.get('/get-signed-url', FieldMappingController.getSignedUrl)

// POST /field-mappings/process-s3-xlsx - скачать из S3 и распарсить XLSX файл
router.post('/process-s3-xlsx', XLSXController.processS3XLSX)

module.exports = router 