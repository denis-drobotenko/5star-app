// import { ImportHistory } from '../../shared/models/index.js'; // Закомментировано, так как не используется
// ImportHistory, User, FieldMapping удалены, так как не используются напрямую в контроллере, а только в сервисе
// import { ImportHistory, User, FieldMapping } from '../../shared/models/index.js'; 
import logger from '../config/logger.js';
// s3Client, S3_BUCKET_NAME и Upload удалены, если работа с S3 инкапсулирована в ImportService
// import { s3Client, S3_BUCKET_NAME } from '../config/s3.js'; 
// import { Upload } from "@aws-sdk/lib-storage"; 
import multer from 'multer';
import path from 'path';
// import xlsx from 'xlsx'; // Удалено, если не используется напрямую
import ImportService from '../services/importService.js';
// Настройка Multer для сохранения файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: function (_req, file, cb) {
        // Проверка типа файла (XLSX или XLS)
        const allowedMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        const allowedExtensions = /\.(xlsx|xls)$/i; // Регулярное выражение для расширений
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);
        const isExtensionAllowed = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
        if (isMimeTypeAllowed && isExtensionAllowed) {
            return cb(null, true);
        }
        // Подробное логирование для отладки
        logger.warn(`Попытка загрузки файла с неверным типом/расширением: originalname=${file.originalname}, mimetype=${file.mimetype}, ext=${path.extname(file.originalname)}`);
        cb(new Error("Ошибка: Загружать можно только XLSX или XLS файлы."));
    }
}).single('importFile'); // 'importFile' - имя поля в форме
/**
 * @route GET /api/imports
 * @description Получить список всех историй загрузок
 * @param {number} [query.clientId] - ID клиента для фильтрации
 * @param {string} [query.search] - Строка для поиска по custom_name и file_name
 * @param {string} [query.sortBy=created_at] - Поле для сортировки
 * @param {string} [query.sortOrder=DESC] - Порядок сортировки (ASC/DESC)
 * @param {number} [query.page=1] - Номер страницы
 * @param {number} [query.limit=10] - Количество записей на странице
 * @returns {object} - Список загрузок и информация о пагинации
 * @returns {Error}
 */
export const getAllImports = async (req, res, _next) => {
    const { clientId, search, sortBy, sortOrder, page, limit } = req.query;
    logger.info('[ImportController.getAllImports] Request received. Query: %o, User: %o', req.query, req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' });
    try {
        const result = await ImportService.getAllImportHistories({
            clientId: clientId,
            search: search,
            sortBy: sortBy,
            sortOrder: sortOrder,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined
        });
        res.status(200).json(result);
    }
    catch (error) {
        // Логирование уже происходит в сервисе
        logger.error(`[ImportController.getAllImports] Forwarding error from service. User_id: %s`, req.user?.id);
        const message = error instanceof Error ? error.message : "Ошибка сервера при получении списка загрузок.";
        res.status(500).json({ message, details: error instanceof Error ? error.message : undefined });
    }
};
/**
 * @route POST /api/imports/initiate
 * @description Инициировать новую загрузку (создать запись в ImportHistory)
 * @param {string} [body.custom_name] - Необязательное название загрузки
 * @param {number} body.client_id.required - ID клиента
 * @param {number} body.field_mapping_id.required - ID выбранного маппинга
 * @returns {ImportHistory} - Созданная запись ImportHistory
 * @returns {Error}
 */
export const initiateImport = async (req, res, _next) => {
    const { custom_name, client_id, field_mapping_id } = req.body;
    if (!req.user || !req.user.id) {
        logger.error('[ImportController.initiateImport] User ID not found in request.');
        res.status(401).json({ message: "Пользователь не авторизован или ID пользователя отсутствует." });
        return;
    }
    const user_id = req.user.id;
    logger.info('[ImportController.initiateImport] Request to initiate import. Data: %o, User ID: %s', req.body, user_id);
    if (!client_id || !field_mapping_id) {
        logger.warn('[ImportController.initiateImport] client_id or field_mapping_id missing.');
        res.status(400).json({ message: "client_id и field_mapping_id обязательны." });
        return;
    }
    try {
        const newImport = await ImportService.initiateNewImport({
            custom_name,
            client_id: Number(client_id),
            field_mapping_id: Number(field_mapping_id),
            user_id
        });
        logger.info(`[ImportController.initiateImport] Import initiated successfully. Import data: %o`, newImport);
        res.status(201).json(newImport);
    }
    catch (error) {
        const serviceError = error;
        logger.error(`[ImportController.initiateImport] Error from service: ${serviceError.message}`, { error, body: req.body, user_id });
        if (serviceError.statusCode) {
            res.status(serviceError.statusCode).json({ message: serviceError.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Ошибка сервера при инициации загрузки.";
        res.status(500).json({ message, details: error instanceof Error ? error.message : undefined });
    }
};
/**
 * @route POST /api/imports/:importId/upload-file
 * @description Загрузить файл для существующей записи ImportHistory и обработать его
 * @param {number} importId.path.required - ID записи ImportHistory
 * @param {file} importFile.formData.required - Файл для импорта (XLSX)
 * @returns {object} - Обновленная запись ImportHistory и предварительные данные
 * @returns {Error}
 */
export const uploadAndProcessFile = [
    (req, res, next) => {
        // Вызываем multer. Обработка ошибок multer и последующий вызов основного хендлера
        // будут выполнены внутри этой функции или самим multer.
        upload(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                logger.warn(`[ImportController.uploadAndProcessFile] Multer error: ${err.message}`, { error: err, importId: req.params.importId });
                return res.status(400).json({ message: `Ошибка загрузки файла: ${err.message}` });
            }
            if (err) {
                logger.warn(`[ImportController.uploadAndProcessFile] Non-multer file upload error: ${err.message}`, { error: err, importId: req.params.importId });
                // Ошибка от fileFilter (если есть) или другая
                return res.status(400).json({ message: err.message });
            }
            // Если ошибок нет, req.file должен быть доступен
            if (!req.file) {
                logger.warn('[ImportController.uploadAndProcessFile] No file uploaded after multer middleware. Import ID: %s', req.params.importId);
                return res.status(400).json({ message: "Файл не был загружен." });
            }
            next(); // Переходим к следующему хендлеру в массиве
        });
    },
    async (req, res, next) => {
        try {
            const importId = parseInt(req.params.importId, 10);
            if (!req.user || !req.user.id) {
                logger.error('[ImportController.uploadAndProcessFile] User not found in authenticated request for import ID: %s', importId);
                res.status(401).json({ message: 'Пользователь не авторизован.' });
                return;
            }
            if (!req.file) {
                logger.error('[ImportController.uploadAndProcessFile] File not found in request for import ID: %s', importId);
                res.status(400).json({ message: 'Файл не был загружен.' });
                return;
            }
            const userId = req.user.id;
            const file = req.file;
            logger.info('[ImportController.uploadAndProcessFile] Attempting to upload and process file. Import ID: %s, User: %s, File: %s', importId, userId, file.originalname);
            const result = await ImportService.uploadAndProcessImportFile(importId, userId, file);
            const responseMessage = result.importRecord?.status_details || 'Файл обработан, предпросмотр готов.';
            logger.info('[ImportController.uploadAndProcessFile] File processed for import ID: %s. Status: %s', importId, result.importRecord?.status);
            res.status(200).json({
                message: responseMessage,
                importRecord: result.importRecord,
                statistics: result.statistics
            });
        }
        catch (error) {
            // next(error) передаст ошибку в общий обработчик ошибок Express
            logger.error(`[ImportController.uploadAndProcessFile] Error during file processing for import ID ${req.params.importId}: ${error.message}`, {
                error: error,
                importId: req.params.importId,
                requestingUser: req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
            });
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Внутренняя ошибка сервера при обработке файла.';
            res.status(statusCode).json({ message });
            // Не вызываем next(error) здесь, так как уже отправили ответ
        }
    }
];
/**
 * @route POST /api/imports/:importId/execute
 * @description Загрузить обработанные данные в таблицу orders
 * @param {number} importId.path.required - ID записи ImportHistory
 * @returns {object} - Сообщение об успехе и количество загруженных записей
 * @returns {Error}
 */
export const executeImport = async (req, res, _next) => {
    const { importId } = req.params;
    if (!req.user || !req.user.id) {
        logger.error('[ImportController.executeImport] User ID not found in request for import ID %s.', importId);
        res.status(401).json({ message: "Пользователь не авторизован или ID пользователя отсутствует." });
        return;
    }
    // const user_id = req.user.id;
    // logger.info(`[ImportController.executeImport] Request to execute import ID: ${importId}, User ID: ${user_id}`);
    // try {
    // const result = await ImportService.executeImportProcessing(Number(importId), user_id);
    // res.status(200).json({
    //     message: result.message, // Предполагаем, что result.message существует
    //     importedCount: result.statistics.successfullyInsertedRows,
    //     totalProcessedRows: result.statistics.totalRowsInFile,
    //     importRecord: result.importRecord && typeof (result.importRecord as any).toJSON === 'function' 
    //                     ? (result.importRecord as any).toJSON() 
    //                     : result.importRecord,
    //     statistics: result.statistics
    // });
    logger.warn('[ImportController.executeImport] executeImportProcessing is not implemented yet. Import ID: %s', importId);
    res.status(501).json({ message: "Функционал выполнения импорта еще не реализован." });
    // } catch (error: unknown) {
    //     const serviceError = error as { statusCode?: number, message: string, details?: any };
    //     logger.error(`[ImportController.executeImport] Error executing import ID ${importId}: ${serviceError.message}`, { error, importId, user_id });
    //     const statusCode = serviceError.statusCode || 500;
    //     const message = serviceError.message || 'Ошибка сервера при выполнении импорта.';
    //     res.status(statusCode).json({ message, details: serviceError.details });
    // }
};
