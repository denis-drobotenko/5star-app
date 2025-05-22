const XLSX = require('xlsx')
const FieldMapping = require('../../shared/models/fieldMapping')
const { v4: uuidv4 } = require('uuid')
const logger = require('../config/logger')
const XlsxService = require('../services/xlsxService')
const { validateBody, processS3XLSXSchema } = require('../../shared/validators/xlsxValidator')

/**
 * Загружает и парсит XLSX файл, сохраняет его в S3.
 * @route POST /api/field-mappings/upload-xlsx
 * @group XLSX - Операции с XLSX файлами
 * @param {file} file.formData.required - XLSX файл для загрузки.
 * @returns {object} 200 - Результат парсинга, включая поля, строки, URL на S3.
 * @returns {Error} 400 - Файл не загружен или превышен лимит размера.
 * @returns {Error} 500 - Ошибка сервера.
 */
exports.uploadXLSX = async (req, res, next) => {
  logger.info('[XLSXController.uploadXLSX] Received request to upload XLSX file. File: %s, User: %o', 
    req.file ? req.file.originalname : 'No file', 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );
  try {
    if (!req.file) {
      logger.warn('[XLSXController.uploadXLSX] No file uploaded.');
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const fileSizeInMB = req.file.size / (1024 * 1024);
    if (fileSizeInMB > 20) {
      logger.warn('[XLSXController.uploadXLSX] File size %sMB exceeds limit of 20MB. File: %s', fileSizeInMB.toFixed(2), req.file.originalname);
      return res.status(400).json({ 
        message: `Размер файла (${fileSizeInMB.toFixed(2)}MB) превышает допустимый лимит в 20MB` 
      });
    }

    // Вызываем метод сервиса для обработки файла
    const result = await XlsxService.handleUploadedXlsx(req.file);
    
    logger.info('[XLSXController.uploadXLSX] File %s processed successfully. Returning response.', req.file.originalname);
    res.json(result);

  } catch (error) {
    logger.error('[XLSXController.uploadXLSX] Error processing XLSX upload. File: %s, Error: %s', 
        req.file ? req.file.originalname : 'N/A', error.message, 
        { 
            error: error,
            fileName: req.file ? req.file.originalname : 'N/A',
            requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
        }
    );
    
    // Обработка специфических ошибок, которые могли не быть пойманы в сервисе или являются специфичными для контроллера
    if (error.code === 'LIMIT_FILE_SIZE') { // Эта ошибка генерируется multer до вызова нашего обработчика
      return res.status(400).json({ 
        message: 'Размер файла превышает допустимый лимит в 20MB' 
      });
    }
    // Если сервис бросил ошибку с statusCode, используем его
    if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    next(error); // Для общих ошибок сервера
  }
}

/**
 * Скачивает XLSX файл из S3 по ключу и парсит его.
 * @route POST /api/field-mappings/process-s3-xlsx
 * @group XLSX - Операции с XLSX файлами
 * @param {string} s3Key.body.required - Ключ (путь) к файлу в S3.
 * @returns {object} 200 - Результат парсинга, включая поля, строки.
 * @returns {Error} 400 - Ключ S3 не указан (это проверяется валидатором).
 * @returns {Error} 404 - Файл не найден в S3.
 * @returns {Error} 500 - Ошибка сервера или ошибка парсинга.
 */
exports.processS3XLSX = [
  validateBody(processS3XLSXSchema), // Валидатор проверяет наличие s3Key
  async (req, res, next) => {
    const { s3Key } = req.body;
    const requestingUserForLog = req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' };
    logger.info('[XLSXController.processS3XLSX] Request to process S3 XLSX. Key: %s, User: %o', s3Key, requestingUserForLog);

    try {
      const result = await XlsxService.handleS3Xlsx(s3Key);
      logger.info('[XLSXController.processS3XLSX] S3 XLSX file %s processed successfully.', s3Key);
      res.json(result);

    } catch (error) {
      logger.error('[XLSXController.processS3XLSX] Error processing S3 XLSX. Key: %s, Error: %s',
        s3Key, error.message, 
        {
            error: error, 
            s3Key: s3Key, 
            requestingUser: requestingUserForLog
        }
      );
      
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      // Для непредвиденных ошибок без statusCode от сервиса
      next(error);
    }
  }
];

// exports.saveMapping = async (req, res) => {
//   try {
//     const { mapping, name } = req.body
//     const companyId = req.user.company_id // Предполагаем, что у пользователя есть привязка к компании

//     // Создаем новый маппинг
//     const fieldMapping = await FieldMapping.create({
//       company_id: companyId,
//       name,
//       mapping: mapping,
//       created_at: new Date(),
//       updated_at: new Date()
//     })

//     res.json({ 
//       message: 'Маппинг успешно сохранен',
//       mapping: fieldMapping 
//     })
//   } catch (error) {
//     console.error('Ошибка при сохранении маппинга:', error)
//     res.status(500).json({ message: 'Ошибка при сохранении маппинга' })
//   }
// } 