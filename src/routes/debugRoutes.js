const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');
const authMiddleware = require('../middlewares/auth');

// Защищаем маршруты авторизацией
router.use(authMiddleware);

// Маршруты для отладочных логов
router.post('/debug-log', debugController.writeLog);
router.get('/debug-log', debugController.getLogs);

module.exports = router; 