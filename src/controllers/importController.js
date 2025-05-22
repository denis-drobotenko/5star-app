const { ImportHistory, Company, User, FieldMapping, Client } = require('../models');
const logger = require('../config/logger');
const { s3Client, S3_BUCKET_NAME } = require('../config/s3');
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx'); // Для обработки XLSX файлов
const ImportService = require('../services/importService'); // Добавляем сервис

// Настройка Multer для сохранения файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
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
exports.getAllImports = async (req, res) => {
    const { clientId, search, sortBy, sortOrder, page, limit } = req.query;
    logger.info('[ImportController.getAllImports] Request received. Query: %o, User: %o', 
        req.query, 
        req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
    );
    try {
        const result = await ImportService.getAllImportHistories({ 
            clientId, 
            search, 
            sortBy, 
            sortOrder, 
            page, 
            limit 
        });
        res.status(200).json(result);
    } catch (error) {
        // Логирование уже происходит в сервисе
        logger.error(`[ImportController.getAllImports] Forwarding error from service. User_id: %s`, req.user?.id);
        res.status(500).json({ message: "Ошибка сервера при получении списка загрузок.", details: error.message });
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
exports.initiateImport = async (req, res) => {
    const { custom_name, client_id, field_mapping_id } = req.body;
    const user_id = req.user.id;
    logger.info('[ImportController.initiateImport] Request to initiate import. Data: %o, User ID: %s', req.body, user_id);

    if (!client_id || !field_mapping_id) {
        // Эта проверка может остаться здесь для быстрого ответа, или полностью делегирована сервису.
        // Оставим для ясности, что эти поля обязательны на уровне API.
        logger.warn('[ImportController.initiateImport] client_id or field_mapping_id missing.');
        return res.status(400).json({ message: "client_id и field_mapping_id обязательны." });
    }

    try {
        const newImport = await ImportService.initiateNewImport({
            custom_name,
            client_id,
            field_mapping_id,
            user_id
        });
        logger.info(`[ImportController.initiateImport] Import initiated successfully. Import ID: ${newImport.id}`);
        res.status(201).json(newImport);
    } catch (error) {
        logger.error(`[ImportController.initiateImport] Error from service: ${error.message}`, { error, body: req.body, user_id });
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка сервера при инициации загрузки.", details: error.message });
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
exports.uploadAndProcessFile = async (req, res) => {
    const { importId } = req.params;
    const user_id = req.user.id;
    const userForLog = { id: req.user.id, role: req.user.role, client_id: req.user.client_id };

    logger.info('[ImportController.uploadFile] Request to upload file for import ID: %s. User: %o', importId, userForLog);

    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            logger.warn('[ImportController.uploadFile] Multer error for import ID %s: %s', importId, err.message, { error: err });
            return res.status(400).json({ message: `Ошибка загрузки файла: ${err.message}` });
        } else if (err) {
            logger.warn('[ImportController.uploadFile] Non-multer file upload error for import ID %s: %s', importId, err.message, { error: err });
            return res.status(400).json({ message: err.message }); // Ошибка от fileFilter
        }
        if (!req.file) {
            logger.warn('[ImportController.uploadFile] No file uploaded for import ID %s.', importId);
            return res.status(400).json({ message: "Файл не был загружен." });
        }

        try {
            const result = await ImportService.uploadAndProcessImportFile(importId, user_id, req.file);
            
            res.status(200).json({
                message: result.message,
                statistics: result.statistics,
                importRecord: result.importRecord.toJSON ? result.importRecord.toJSON() : result.importRecord
            });

        } catch (error) {
            logger.error('[ImportController.uploadFile] Error during file upload and processing for import ID %s: %s', importId, error.message, {
                error: error, // Логируем полную ошибку, включая ее свойства, если есть
                importId: importId,
                requestingUser: userForLog
            });
            // Сервис должен сам обновлять статус ImportHistory в случае ошибки.
            // Если ошибка имеет statusCode, используем его, иначе 500.
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({ message: error.message || 'Внутренняя ошибка сервера при обработке файла.' });
        }
    });
};


/**
 * @route POST /api/imports/:importId/execute
 * @description Загрузить обработанные данные в таблицу orders
 * @param {number} importId.path.required - ID записи ImportHistory
 * @returns {object} - Сообщение об успехе и количество загруженных записей
 * @returns {Error}
 */
exports.executeImport = async (req, res) => {
    const { importId } = req.params;
    const user_id = req.user.id;
    logger.info(`[ImportController.executeImport] Request to execute import ID: ${importId}, User ID: ${user_id}`);

    try {
        const result = await ImportService.executeImportProcessing(importId, user_id);

        res.status(200).json({
            message: result.message,
            importedCount: result.statistics.successfullyInsertedRows,
            totalProcessedRows: result.statistics.totalRowsInFile,
            importRecord: result.importRecord.toJSON ? result.importRecord.toJSON() : result.importRecord,
            statistics: result.statistics // Можно передать всю статистику, если на фронте это нужно
        });

    } catch (error) {
        logger.error(`[ImportController.executeImport] Error executing import ID ${importId}: ${error.message}`, { error, importId, user_id });
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Ошибка сервера при выполнении импорта.', details: error.details });
    }
};

module.exports = exports; 