import { Request, Response, NextFunction } from 'express';
// import XLSX from 'xlsx' // Не используется
// import FieldMapping from '../../shared/models/fieldMapping.js' // Не используется
// import { v4 as uuidv4 } from 'uuid' // Не используется
import logger from '../config/logger.js'
import XlsxService from '../services/xlsxService.js'
import { validateBody, processS3XLSXSchema } from '../../shared/validators/xlsxValidator.js'
// import { AuthenticatedRequest } from '../types/express/index.js' // Удаляем этот импорт

/**
 * Загружает и парсит XLSX файл, сохраняет его в S3.
 * @route POST /api/field-mappings/upload-xlsx
 * @group XLSX - Операции с XLSX файлами
 * @param {file} file.formData.required - XLSX файл для загрузки.
 * @returns {object} 200 - Результат парсинга, включая поля, строки, URL на S3.
 * @returns {Error} 400 - Файл не загружен или превышен лимит размера.
 * @returns {Error} 500 - Ошибка сервера.
 */
export async function uploadXLSX(req: Request, res: Response, next: NextFunction): Promise<void> {
  logger.info('[XLSXController.uploadXLSX] Received request to upload XLSX file. File: %s, User: %o', 
    req.file ? req.file.originalname : 'No file', 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );
  try {
    if (!req.file) {
      logger.warn('[XLSXController.uploadXLSX] No file uploaded.');
      res.status(400).json({ message: 'Файл не загружен' });
      return;
    }

    const fileSizeInMB = req.file.size / (1024 * 1024);
    if (fileSizeInMB > 20) {
      logger.warn('[XLSXController.uploadXLSX] File size %sMB exceeds limit of 20MB. File: %s', fileSizeInMB.toFixed(2), req.file.originalname);
      res.status(400).json({ 
        message: `Размер файла (${fileSizeInMB.toFixed(2)}MB) превышает допустимый лимит в 20MB` 
      });
      return;
    }

    // Вызываем метод сервиса для обработки файла
    const result = await XlsxService.handleUploadedXlsx(req.file);
    
    logger.info('[XLSXController.uploadXLSX] File %s processed successfully. Returning response.', req.file.originalname);
    res.json(result);

  } catch (error: unknown) {
    logger.error('[XLSXController.uploadXLSX] Error processing XLSX upload. File: %s, Error: %s', 
        req.file ? req.file.originalname : 'N/A', (error instanceof Error ? error.message : 'Unknown error'), 
        { 
            error: error,
            fileName: req.file ? req.file.originalname : 'N/A',
            requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
        }
    );
    
    const serviceError = error as { code?: string, statusCode?: number, message: string };

    // Обработка специфических ошибок, которые могли не быть пойманы в сервисе или являются специфичными для контроллера
    if (serviceError.code === 'LIMIT_FILE_SIZE') { // Эта ошибка генерируется multer до вызова нашего обработчика
      res.status(400).json({ 
        message: 'Размер файла превышает допустимый лимит в 20MB' 
      });
      return;
    }
    // Если сервис бросил ошибку с statusCode, используем его
    if (serviceError.statusCode) {
        res.status(serviceError.statusCode).json({ message: serviceError.message });
        return;
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
export const processS3XLSX = [
  validateBody(processS3XLSXSchema), // Валидатор проверяет наличие s3Key
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { s3Key } = req.body as { s3Key: string };
    const requestingUserForLog = req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' };
    logger.info('[XLSXController.processS3XLSX] Request to process S3 XLSX. Key: %s, User: %o', s3Key, requestingUserForLog);

    try {
      const result = await XlsxService.handleS3Xlsx(s3Key);
      logger.info('[XLSXController.processS3XLSX] S3 XLSX file %s processed successfully.', s3Key);
      res.json(result);

    } catch (error: unknown) {
      logger.error('[XLSXController.processS3XLSX] Error processing S3 XLSX. Key: %s, Error: %s',
        s3Key, (error instanceof Error ? error.message : 'Unknown error'), 
        {
            error: error, 
            s3Key: s3Key, 
            requestingUser: requestingUserForLog
        }
      );
      
      const serviceError = error as { statusCode?: number, message: string };
      if (serviceError.statusCode) {
        res.status(serviceError.statusCode).json({ message: serviceError.message });
        return;
      }
      // Для непредвиденных ошибок без statusCode от сервиса
      next(error);
    }
  }
];

// Добавляем недостающие экспорты, если они есть в xlsxRoutes.ts
export async function upload(req: Request, res: Response, _next: NextFunction): Promise<void> {
  // TODO: Реализовать или удалить, если не используется
  logger.warn('[XLSXController.upload] Function not implemented, called for file: %s', req.file ? req.file.originalname : 'No file');
  res.status(501).json({ message: 'Not Implemented' });
}

export async function getTemplate(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  // TODO: Реализовать или удалить, если не используется
  logger.warn('[XLSXController.getTemplate] Function not implemented.');
  res.status(501).json({ message: 'Not Implemented' });
}

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