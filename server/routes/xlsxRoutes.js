const express = require('express')
const router = express.Router()
const upload = require('../middlewares/upload')
const { uploadXLSX } = require('../controllers/xlsxController')
const authenticateToken = require('../middlewares/auth')

// Загрузка XLSX файла
router.post('/upload-xlsx', authenticateToken, upload.single('file'), uploadXLSX)

module.exports = router 