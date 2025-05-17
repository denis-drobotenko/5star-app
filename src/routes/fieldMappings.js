const express = require('express')
const router = express.Router()
const FieldMappingController = require('../controllers/fieldMappingController')
const authMiddleware = require('../middlewares/auth')

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

module.exports = router 