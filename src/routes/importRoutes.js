const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const authMiddleware = require('../middlewares/auth'); // Исправленный путь и имя файла

// Получить все истории загрузок (с фильтрацией и пагинацией)
// GET /api/imports?companyId=1&page=1&limit=10&sortBy=created_at&sortOrder=DESC
router.get('/', authMiddleware, importController.getAllImports);

// Инициировать новую загрузку (создать запись в ImportHistory)
// POST /api/imports/initiate
router.post('/initiate', authMiddleware, importController.initiateImport);

// Загрузить файл для существующей записи ImportHistory, обработать и вернуть превью
// POST /api/imports/:importId/upload-file
router.post('/:importId/upload-file', authMiddleware, importController.uploadAndProcessFile);

// Выполнить окончательную загрузку данных из файла (связанного с ImportHistory) в таблицу orders
// POST /api/imports/:importId/execute
router.post('/:importId/execute', authMiddleware, importController.executeImport);

// TODO: Возможно, понадобятся еще роуты:
// - GET /api/imports/:id - получить одну запись ImportHistory по ID
// - DELETE /api/imports/:id - удалить запись ImportHistory (и, возможно, файл из S3)
// - PUT /api/imports/:id - обновить какую-то информацию в ImportHistory (например, custom_name)

module.exports = router; 