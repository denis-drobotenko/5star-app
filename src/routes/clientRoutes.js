const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
// const { protect, authorize } = require('../middlewares/auth'); // Старый импорт
const protectMiddleware = require('../middlewares/auth'); // Новый импорт protect
const authorizeMiddleware = require('../middlewares/roles'); // Новый импорт authorize (checkRole)
const upload = require('../middlewares/upload'); // Импорт multer middleware

// Маршруты для клиентов
router.get('/', protectMiddleware, clientController.getAll); // Защищаем получение всех клиентов
router.post(
  '/', 
  protectMiddleware, 
  authorizeMiddleware(['ADMIN', 'MANAGER']), 
  upload.single('logoFile'), // Middleware для загрузки одного файла из поля 'logoFile'
  clientController.create
); // Защищаем создание, разрешаем ADMIN и MANAGER

router.get('/:id', protectMiddleware, clientController.getById); // Защищаем получение по ID
router.put(
  '/:id',
  protectMiddleware,
  authorizeMiddleware(['ADMIN', 'MANAGER']),
  upload.single('logoFile'), // Middleware для загрузки одного файла из поля 'logoFile'
  clientController.update
); // Защищаем обновление
router.delete('/:id', protectMiddleware, authorizeMiddleware(['ADMIN', 'MANAGER']), clientController.remove); // Защищаем удаление

module.exports = router; 