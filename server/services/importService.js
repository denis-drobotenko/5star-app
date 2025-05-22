import { ImportHistory, User, FieldMapping, Client, sequelize } from '../../shared/models/index.js';
import logger from '../../shared/models/logger.js';
import { s3Client, S3_BUCKET_NAME } from '../config/s3.js';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from "@aws-sdk/lib-storage";
import xlsx from 'xlsx';
import { Op } from 'sequelize';
import moment from 'moment';
class ImportService {
    /**
     * Get all import histories with pagination, filtering, and sorting.
     * @param {object} filters - Filtering options.
     * @param {number} [filters.clientId] - ID of the client.
     * @param {string} [filters.search] - Search string for custom_name and file_name.
     * @param {string} [filters.sortBy='created_at'] - Field to sort by.
     * @param {string} [filters.sortOrder='DESC'] - Sort order (ASC/DESC).
     * @param {number} [filters.page=1] - Page number.
     * @param {number} [filters.limit=10] - Records per page.
     * @returns {Promise<object>} - { totalItems, totalPages, currentPage, items: ImportHistory[] }
     */
    static async getAllImportHistories({ clientId, search, sortBy = 'created_at', sortOrder = 'DESC', page = 1, limit = 10 }) {
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const whereClause = {};
        if (clientId) {
            whereClause.client_id = clientId;
        }
        if (search) {
            whereClause[Op.or] = [
                { custom_name: { [Op.iLike]: `%${search}%` } },
                { file_name: { [Op.iLike]: `%${search}%` } }
            ];
        }
        try {
            const { count, rows } = await ImportHistory.findAndCountAll({
                where: whereClause,
                include: [
                    { model: Client, as: 'client', attributes: ['id', 'name'] },
                    { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] },
                    { model: FieldMapping, as: 'fieldMapping', attributes: ['id', 'name'] }
                ],
                order: [[sortBy, sortOrder.toUpperCase()]],
                limit: parseInt(limit, 10),
                offset: offset,
            });
            return {
                totalItems: count,
                totalPages: Math.ceil(count / parseInt(limit, 10)),
                currentPage: parseInt(page, 10),
                items: rows
            };
        }
        catch (error) {
            // Собираем контекст для лога из доступных переменных
            const logContext = { clientId, search, sortBy, sortOrder, page, limit };
            logger.error(`[ImportService.getAllImportHistories] Error getting import histories: ${error.message}`, { error, context: logContext });
            throw error;
        }
    }
    /**
     * Initiates a new import by creating an ImportHistory record.
     * @param {object} data - Data for initiating the import.
     * @param {string} [data.custom_name] - Optional custom name for the import.
     * @param {number} data.client_id - ID of the client.
     * @param {number} data.field_mapping_id - ID of the field mapping to use.
     * @param {number} data.user_id - ID of the user initiating the import.
     * @returns {Promise<InstanceType<typeof ImportHistory> | undefined>} - The created ImportHistory record or undefined if an error occurs before assignment.
     * @throws {Error} If client/mapping not found, mapping doesn't belong to client, or DB error.
     */
    static async initiateNewImport({ custom_name, client_id, field_mapping_id, user_id }) {
        logger.debug('[ImportService.initiateNewImport] Initiating import for client_id: %s, mapping_id: %s, user_id: %s', client_id, field_mapping_id, user_id);
        let newImportRecord;
        try {
            await sequelize.transaction(async (t) => {
                const clientExists = await Client.findByPk(client_id, { transaction: t });
                if (!clientExists) {
                    logger.warn('[ImportService.initiateNewImport] Client not found. client_id: %s', client_id);
                    const error = new Error("Клиент не найден.");
                    error.statusCode = 404;
                    throw error;
                }
                const mappingExists = await FieldMapping.findByPk(field_mapping_id, { transaction: t });
                if (!mappingExists) {
                    logger.warn('[ImportService.initiateNewImport] FieldMapping not found. field_mapping_id: %s', field_mapping_id);
                    const error = new Error("Правило маппинга не найдено.");
                    error.statusCode = 404;
                    throw error;
                }
                if (mappingExists.client_id !== parseInt(client_id)) {
                    logger.warn('[ImportService.initiateNewImport] FieldMapping client_id %s does not match provided client_id %s.', mappingExists.client_id, client_id);
                    const error = new Error("Выбранный маппинг не принадлежит указанному клиенту.");
                    error.statusCode = 400;
                    throw error;
                }
                const newImport = await ImportHistory.create({
                    custom_name,
                    client_id,
                    user_id,
                    file_name: 'pending_upload',
                    source_type: 'pending_upload',
                    status: 'initiated',
                    field_mapping_id: field_mapping_id,
                }, { transaction: t });
                logger.info(`[ImportService.initiateNewImport] New import initiated successfully within transaction. Import ID: ${newImport.id}`);
                newImportRecord = newImport; // Присваиваем для возврата
            });
            return newImportRecord;
        }
        catch (error) {
            if (!error.statusCode) {
                logger.error(`[ImportService.initiateNewImport] Database error while creating import history: ${error.message}`, { error, custom_name, client_id, field_mapping_id, user_id });
            }
            throw error;
        }
    }
    /**
     * Uploads a file for an existing import record, saves it to S3, and then processes the file content based on mapping rules.
     * @param {number} importId - The ID of the ImportHistory record.
     * @param {number} userId - The ID of the user performing the upload.
     * @param {object} file - The file object from multer (req.file).
     * @returns {Promise<object>} - Updated importRecord and processing statistics.
     * @throws {Error} - Various errors related to DB, S3, file processing, or permissions.
     */
    static async uploadAndProcessImportFile(importId, userId, file) {
        logger.info('[ImportService.uploadAndProcessImportFile] Uploading and processing file for import ID: %s, User ID: %s, File: %s', importId, userId, file.originalname);
        if (!S3_BUCKET_NAME) {
            logger.error('[ImportService.uploadAndProcessImportFile] S3_BUCKET_NAME is not configured.');
            const err = new Error("Ошибка сервера: S3_BUCKET_NAME не настроен.");
            err.statusCode = 500;
            throw err;
        }
        let importRecord;
        let client;
        const fileExtension = require('path').extname(file.originalname);
        let s3Key;
        let s3UploadSuccessful = false;
        // --- Этап 1: Загрузка файла в S3 и обновление ImportHistory ---
        try {
            await sequelize.transaction(async (uploadTransaction) => {
                const record = await ImportHistory.findOne({
                    where: { id: importId, user_id: userId },
                    include: [{ model: Client, as: 'client' }],
                    transaction: uploadTransaction
                });
                if (!record) {
                    logger.warn('[ImportService.uploadAndProcessImportFile] Import record not found or insufficient permissions. Import ID: %s, User ID: %s', importId, userId);
                    const err = new Error("Запись о загрузке не найдена или у вас нет прав на её изменение.");
                    err.statusCode = 404;
                    throw err;
                }
                importRecord = record;
                const allowedStatusesForUpload = ['initiated', 'file_upload_failed', 'processing_failed', 'preview_ready'];
                if (!allowedStatusesForUpload.includes(importRecord.status)) {
                    logger.warn('[ImportService.uploadAndProcessImportFile] Cannot upload file for import ID %s. Status is \\\'%s\\\'. Expected one of: %s', importId, importRecord.status, allowedStatusesForUpload.join(', '));
                    const err = new Error(`Нельзя загрузить файл для импорта со статусом '${importRecord.status}'.`);
                    err.statusCode = 400;
                    throw err;
                }
                let oldProcessedDataKey = null;
                let oldErrorDataKey = null;
                if (importRecord.status === 'preview_ready' && importRecord.s3_key_original_file) {
                    logger.info(`[ImportService.uploadAndProcessImportFile] Import ID ${importId} is in 'preview_ready' state with an existing file. Will replace existing file and clear previous preview data.`);
                    oldProcessedDataKey = importRecord.s3_key_processed_data;
                    oldErrorDataKey = importRecord.s3_key_error_data;
                    // Не удаляем s3_key_original_file здесь, чтобы не потерять его, если загрузка нового файла провалится
                    // Он будет перезаписан ниже после успешной загрузки нового файла.
                    // Старые файлы данных (processed, error) будут удалены после успешной загрузки нового.
                }
                client = importRecord.client;
                if (!client) {
                    logger.error('[ImportService.uploadAndProcessImportFile] Client not found for import record ID %s.', importId);
                    const err = new Error("Клиент, связанный с этой загрузкой, не найден.");
                    err.statusCode = 404;
                    throw err;
                }
                s3Key = `import-files/client_${client.id}/import_${importRecord.id}/${Date.now()}${fileExtension}`;
                const uploadParams = {
                    Bucket: S3_BUCKET_NAME,
                    Key: s3Key,
                    Body: file.buffer,
                    ContentType: file.mimetype
                };
                logger.debug('[ImportService.uploadAndProcessImportFile] Attempting to upload file to S3 for import ID %s. Key: %s', importId, s3Key);
                const uploader = new Upload({
                    client: s3Client,
                    params: uploadParams,
                });
                const s3UploadResult = await uploader.done();
                s3UploadSuccessful = true;
                const s3Location = s3UploadResult.Location || `s3://${S3_BUCKET_NAME}/${s3Key}`;
                const oldOriginalFileKey = importRecord.s3_key_original_file; // Сохраняем старый ключ оригинального файла
                importRecord.file_name = file.originalname;
                importRecord.source_type = file.mimetype;
                importRecord.source_link = s3Location;
                importRecord.s3_key_original_file = s3Key;
                importRecord.status = 'file_uploaded';
                importRecord.processing_started_at = null; // Сброс времени начала обработки
                importRecord.processing_finished_at = null; // Сброс времени окончания обработки
                importRecord.rows_successfully_previewed = null;
                importRecord.rows_failed_preview = null;
                importRecord.s3_key_processed_data = null;
                importRecord.s3_key_error_data = null;
                importRecord.status_details = 'Файл успешно загружен, ожидает обработки.';
                logger.info(`[ImportService.uploadAndProcessImportFile] About to save ImportHistory ID ${importRecord.id} with s3_key_original_file: ${s3Key} and status: ${importRecord.status} within uploadTransaction.`);
                await importRecord.save({ transaction: uploadTransaction });
                logger.info(`[ImportService.uploadAndProcessImportFile] File ${s3Key} uploaded to S3 and ImportHistory ID ${importId} updated. Record after save: %o`, importRecord.toJSON());
                // Удаляем старый оригинальный файл, если он был и новый успешно загружен
                if (oldOriginalFileKey && oldOriginalFileKey !== s3Key) {
                    try {
                        logger.info(`[ImportService.uploadAndProcessImportFile] Deleting old original file from S3: ${oldOriginalFileKey}`);
                        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldOriginalFileKey }));
                    }
                    catch (delErr) {
                        logger.warn(`[ImportService.uploadAndProcessImportFile] Failed to delete old original file ${oldOriginalFileKey} from S3: ${delErr.message}`);
                    }
                }
                // Удаляем старые файлы данных предпросмотра, если они были
                if (oldProcessedDataKey) {
                    try {
                        logger.info(`[ImportService.uploadAndProcessImportFile] Deleting old processed data from S3: ${oldProcessedDataKey}`);
                        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldProcessedDataKey }));
                    }
                    catch (delErr) {
                        logger.warn(`[ImportService.uploadAndProcessImportFile] Failed to delete old processed data ${oldProcessedDataKey} from S3: ${delErr.message}`);
                    }
                }
                if (oldErrorDataKey) {
                    try {
                        logger.info(`[ImportService.uploadAndProcessImportFile] Deleting old error data from S3: ${oldErrorDataKey}`);
                        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldErrorDataKey }));
                    }
                    catch (delErr) {
                        logger.warn(`[ImportService.uploadAndProcessImportFile] Failed to delete old error data ${oldErrorDataKey} from S3: ${delErr.message}`);
                    }
                }
            });
        }
        catch (error) {
            logger.error(`[ImportService.uploadAndProcessImportFile] Error during S3 upload or initial DB update for import ID ${importId}: ${error.message}`, { error, importId, userId, fileName: file.originalname });
            // Если файл был загружен на S3, но произошла ошибка при обновлении БД, удаляем файл из S3
            if (s3UploadSuccessful && s3Key && !error.statusCode) { // Предполагаем, что системные ошибки не имеют statusCode
                try {
                    logger.warn(`[ImportService.uploadAndProcessImportFile] Rolling back S3 upload due to DB error. Deleting ${s3Key}`);
                    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: s3Key }));
                }
                catch (s3DeleteError) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Failed to delete ${s3Key} from S3 during rollback: ${s3DeleteError.message}`, { s3DeleteError });
                }
            }
            // Обновляем статус в БД, если запись была найдена
            if (importRecord && importRecord.id) { // Проверяем, что importRecord был загружен
                try {
                    await ImportHistory.update({ status: 'file_upload_failed', status_details: `Ошибка при загрузке файла: ${error.message}` }, { where: { id: importRecord.id } });
                }
                catch (statusUpdateError) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Failed to update import status to 'file_upload_failed' for import ID ${importRecord.id}: ${statusUpdateError.message}`, { statusUpdateError });
                }
            }
            throw error; // Перебрасываем исходную ошибку
        }
        // --- Этап 2: Обработка файла (парсинг, применение правил) ---
        // Этап выполняется после успешной загрузки файла и обновления записи ImportHistory
        // Используем новую транзакцию для этого этапа.
        let processingStats = {
            totalRows: 0,
            successfullyProcessedRows: 0,
            failedRows: 0,
            processedData: [],
            errorData: [],
            sample_rows: [], // Для предпросмотра
            parse_errors: [], // Ошибки парсинга самого файла, если есть
            fileHeaders: [], // Для возврата заголовков на фронтенд
        };
        let processingSuccessful = false;
        let processedDataS3Key = null;
        let errorDataS3Key = null;
        try {
            await sequelize.transaction(async (processingTransaction) => {
                // Получаем свежую запись ImportHistory, так как она могла быть изменена
                // или чтобы убедиться, что работаем с актуальными данными в этой транзакции
                importRecord = await ImportHistory.findByPk(importId, {
                    include: [
                        { model: FieldMapping, as: 'fieldMapping' },
                        { model: Client, as: 'client' }
                    ],
                    transaction: processingTransaction
                });
                if (!importRecord) { // Дополнительная проверка, хотя на первом этапе уже есть
                    logger.error(`[ImportService.uploadAndProcessImportFile] Import record ${importId} not found before processing stage.`);
                    const err = new Error("Запись об импорте не найдена перед этапом обработки.");
                    err.statusCode = 404;
                    throw err;
                }
                if (importRecord.status !== 'file_uploaded') {
                    logger.warn(`[ImportService.uploadAndProcessImportFile] Import ID ${importId} is not in 'file_uploaded' state for processing. Current status: ${importRecord.status}. Aborting processing.`);
                    const err = new Error(`Файл для импорта ${importId} не готов к обработке (статус: ${importRecord.status}).`);
                    err.statusCode = 400;
                    throw err;
                }
                importRecord.status = 'processing';
                importRecord.processing_started_at = new Date();
                importRecord.status_details = 'Идет обработка файла...';
                await importRecord.save({ transaction: processingTransaction });
                logger.info(`[ImportService.uploadAndProcessImportFile] Import ID ${importId} status updated to 'processing'.`);
                const fieldMappingModel = importRecord.fieldMapping; // Экземпляр модели FieldMapping
                // Проверяем наличие поля mapping, которое должно содержать правила
                if (!fieldMappingModel || !fieldMappingModel.mapping) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Field mapping data (JSONB field 'mapping') not found for import ID ${importId}. FieldMapping ID: ${importRecord.field_mapping_id}`);
                    const err = new Error("Данные правил маппинга (поле JSONB 'mapping') не найдены или неполны.");
                    err.statusCode = 400;
                    throw err;
                }
                // Используем fieldMappingModel.mapping, которое должно быть объектом правил
                const rawMappingObject = fieldMappingModel.mapping;
                logger.info(`[ImportService.uploadAndProcessImportFile] Raw mapping data from DB (fieldMappingModel.mapping) for import ID ${importId}: %o`, rawMappingObject);
                if (typeof rawMappingObject !== 'object' || rawMappingObject === null || Array.isArray(rawMappingObject)) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Field mapping data in importRecord.fieldMapping.mapping is not a valid object. Import ID ${importId}. Data: %o`, rawMappingObject);
                    const err = new Error("Формат данных маппинга некорректен (ожидался объект в поле 'mapping').");
                    err.statusCode = 500;
                    throw err;
                }
                const getObjectParams = { Bucket: S3_BUCKET_NAME, Key: importRecord.s3_key_original_file };
                logger.debug(`[ImportService.uploadAndProcessImportFile] Getting original file ${importRecord.s3_key_original_file} from S3 for processing.`);
                const command = new GetObjectCommand(getObjectParams);
                const s3File = await s3Client.send(command);
                const fileBuffer = await streamToBuffer(s3File.Body);
                logger.info(`[ImportService.uploadAndProcessImportFile] Successfully retrieved file ${importRecord.s3_key_original_file} from S3. Buffer length: ${fileBuffer.length}`);
                const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true, dateNF: 'dd.mm.yyyy hh:mm:ss' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                if (jsonData.length === 0) {
                    processingStats.parse_errors.push("Файл пустой или не удалось прочитать данные.");
                    // Не бросаем ошибку сразу, дадим записать это в status_details
                }
                const headers = jsonData[0] || [];
                const dataRows = jsonData.slice(1);
                processingStats.totalRows = dataRows.length;
                processingStats.fileHeaders = headers; // Сохраняем заголовки в статистику
                logger.info(`[ImportService.uploadAndProcessImportFile] File parsed. Headers: [${headers.join(', ')}]. Total data rows: ${processingStats.totalRows}`);
                const mappingRules = {};
                for (const systemFieldName in rawMappingObject) {
                    if (rawMappingObject.hasOwnProperty(systemFieldName)) {
                        const ruleData = rawMappingObject[systemFieldName];
                        // Правило считаем активным, если указано поле из файла (ruleData.field)
                        // и оно не является null или пустой строкой.
                        // Флаг is_enabled в текущей структуре отсутствует.
                        const isRuleEnabled = !!(ruleData && ruleData.field && String(ruleData.field).trim() !== '');
                        if (isRuleEnabled) {
                            mappingRules[systemFieldName] = {
                                file_header_name: ruleData.field,
                                default_value: ruleData.default_value || null,
                                processing_function: (ruleData.processing && ruleData.processing.function) ? ruleData.processing.function : 'NONE',
                                function_params: (ruleData.processing && ruleData.processing.params) ? ruleData.processing.params : {},
                                is_identifier: ruleData.is_identifier || false,
                                is_required: ruleData.is_required || false,
                            };
                        }
                        else {
                            // Если правило неактивно (например, ruleData.field не задан), 
                            // но все равно есть в объекте rawMappingObject, мы можем его проигнорировать
                            // или обработать поля, которые должны быть заполнены по умолчанию, даже если нет file_header_name
                            // Пока просто логируем и пропускаем, если не указано file_header_name
                            if (ruleData && ruleData.default_value) { // Если есть default_value, но нет file_header_name
                                mappingRules[systemFieldName] = {
                                    file_header_name: null, // Явно указываем, что из файла не берется
                                    default_value: ruleData.default_value,
                                    processing_function: (ruleData.processing && ruleData.processing.function) ? ruleData.processing.function : 'NONE',
                                    function_params: (ruleData.processing && ruleData.processing.params) ? ruleData.processing.params : {},
                                    is_identifier: ruleData.is_identifier || false,
                                    is_required: ruleData.is_required || false, // Если поле только по умолчанию, оно может быть не required из файла
                                };
                                logger.debug(`[ImportService.uploadAndProcessImportFile] System field '${systemFieldName}' will be populated by default value '${ruleData.default_value}' as file_header_name is not set.`);
                            }
                            else {
                                logger.debug(`[ImportService.uploadAndProcessImportFile] Skipping rule for system field '${systemFieldName}' as it's not enabled (no file_header_name and no default value without it). RuleData: %o`, ruleData);
                            }
                        }
                    }
                }
                logger.debug('[ImportService.uploadAndProcessImportFile] Effective mapping rules after processing raw object: %o', mappingRules);
                const systemFields = await this.getSystemFieldDefinitions();
                for (let i = 0; i < dataRows.length; i++) {
                    const row = dataRows[i];
                    const processedRow = {};
                    const rowErrors = [];
                    // let hasIdentifierConflict = false; // Флаг для конфликта идентификаторов в текущей строке
                    for (const systemFieldName in mappingRules) {
                        const rule = mappingRules[systemFieldName];
                        const headerIndex = headers.indexOf(rule.file_header_name);
                        let value = headerIndex !== -1 ? row[headerIndex] : null;
                        // 1. Применение значения по умолчанию, если значение из файла отсутствует
                        if ((value === null || value === undefined || String(value).trim() === '') && rule.default_value) {
                            value = rule.default_value;
                            logger.debug(`[ImportService.uploadAndProcessImportFile] Row ${i + 1}, Field '${systemFieldName}': Used default value '${value}'. Original was empty/null.`);
                        }
                        // 2. Применение функции обработки
                        if (rule.processing_function) {
                            try {
                                const originalValueForLog = value;
                                value = this._applyProcessingFunction(value, rule.processing_function, rule.function_params);
                                logger.debug(`[ImportService.uploadAndProcessImportFile] Row ${i + 1}, Field '${systemFieldName}': Function '${rule.processing_function}' applied. Input: '${originalValueForLog}', Output: '${value}'`);
                            }
                            catch (funcError) {
                                logger.warn(`[ImportService.uploadAndProcessImportFile] Row ${i + 1}, Field '${systemFieldName}': Error applying function '${rule.processing_function}': ${funcError.message}`);
                                rowErrors.push({
                                    field: systemFieldName,
                                    header: rule.file_header_name || 'N/A',
                                    value: value,
                                    error: `Ошибка функции '${rule.processing_function}': ${funcError.message}`
                                });
                                // Если функция обработки не смогла вернуть значение, оно может остаться undefined или как было до функции
                            }
                        }
                        // 3. Валидация обязательных полей (после функции обработки и значения по умолчанию)
                        if (rule.is_required && (value === null || value === undefined || String(value).trim() === '')) {
                            logger.warn(`[ImportService.uploadAndProcessImportFile] Row ${i + 1}, Field '${systemFieldName}': Required field is missing or empty after processing/default.`);
                            rowErrors.push({
                                field: systemFieldName,
                                header: rule.file_header_name || 'N/A',
                                value: value,
                                error: 'Обязательное поле не заполнено.'
                            });
                        }
                        // 4. Проверка типов данных и другие валидации (пример)
                        const systemFieldDef = systemFields.find((sf) => sf.name === systemFieldName);
                        // Используем строковое представление для проверки на пустоту, если value определено
                        const valueAsStringForEmptyCheck = (value === null || value === undefined) ? '' : String(value).trim();
                        if (systemFieldDef && value !== null && value !== undefined && valueAsStringForEmptyCheck !== '') {
                            let typeValid = true;
                            let formattedValue = value;
                            switch (systemFieldDef.type) {
                                case 'DATETIME':
                                case 'DATE':
                                    // Moment.js используется в _applyProcessingFunction, но здесь можно добавить доп. проверку, если нужно
                                    // или если функция не использовалась
                                    if (!(value instanceof Date) && !moment(String(value), moment.ISO_8601, true).isValid()) {
                                        // Попытка распарсить популярные форматы, если это не результат _applyProcessingFunction
                                        const parsedDate = moment(String(value), [
                                            "DD.MM.YYYY HH:mm:ss", "DD.MM.YYYY H:mm:ss",
                                            "DD.MM.YYYY", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD"
                                        ], true);
                                        if (parsedDate.isValid()) {
                                            formattedValue = parsedDate.toDate();
                                        }
                                        else {
                                            typeValid = false;
                                            logger.warn(`[ImportService.typeValidation.DATE] Failed for field '${systemFieldName}'. Original value: '${value}' (type ${typeof value}), String(value): '${String(value)}'`);
                                        }
                                    }
                                    else if (value instanceof Date) {
                                        // Уже дата, все ок
                                    }
                                    break;
                                case 'INTEGER':
                                    const cleanedIntValue = String(value).replace(/[\s,]/g, '');
                                    if (!Number.isInteger(Number(cleanedIntValue))) {
                                        typeValid = false;
                                    }
                                    else {
                                        formattedValue = parseInt(String(cleanedIntValue), 10);
                                    }
                                    break;
                                case 'FLOAT':
                                case 'DECIMAL':
                                    const valueStr = String(value);
                                    const cleanedFloatStr = valueStr.replace(/\s/g, '').replace(',', '.');
                                    const parsedNum = parseFloat(cleanedFloatStr);
                                    if (isNaN(parsedNum)) {
                                        typeValid = false;
                                        logger.warn(`[ImportService.typeValidation.FLOAT] Failed for field '${systemFieldName}'. Original: '${value}', Cleaned: '${cleanedFloatStr}', Parsed: ${parsedNum}`);
                                    }
                                    else {
                                        formattedValue = parsedNum;
                                    }
                                    break;
                                // STRING, TEXT - обычно не требуют спец. проверки типа, кроме длины, если есть
                            }
                            logger.debug(`[ImportService.uploadAndProcessImportFile] After switch for field '${systemFieldName}' (type ${systemFieldDef.type}). typeValid: ${typeValid}, original value: '${value}', formattedValue: '${formattedValue}'`);
                            const finalTypeValidCheck = typeValid;
                            // logger.debug(`[ImportService.uploadAndProcessImportFile] Just before IF: field '${systemFieldName}', typeValid: ${typeValid}, finalTypeValidCheck: ${finalTypeValidCheck}`); // Можно закомментировать или удалить
                            // Перенабираем это условие, чтобы исключить скрытые символы
                            if (!finalTypeValidCheck) {
                                logger.error(`[ImportService.uploadAndProcessImportFile] CRITICAL_VALIDATION_FAIL: Field '${systemFieldName}' (Type: ${systemFieldDef.type}) failed typeValid check. Original Value: '${value}' (Type: ${typeof value}), Formatted Value Attempt: '${formattedValue}'. typeValid was ${typeValid}, finalTypeValidCheck was ${finalTypeValidCheck}.`);
                                logger.warn(`[ImportService.uploadAndProcessImportFile] Row ${i + 1}, Field '${systemFieldName}': Type validation failed for type '${systemFieldDef.type}'. Original Value: '${value}', Formatted Value Attempt: '${formattedValue}'`);
                                rowErrors.push({
                                    field: systemFieldName,
                                    header: rule.file_header_name || 'N/A',
                                    value: value, // Используем исходное value, так как оно не прошло валидацию/форматирование
                                    error: `Неверный тип данных, ожидался ${systemFieldDef.type}.`
                                });
                            }
                            else {
                                value = formattedValue; // Применяем отформатированное значение, если тип валиден
                            }
                        }
                        processedRow[systemFieldName] = value;
                    } // конец цикла по systemFieldName (правилам маппинга)
                    // Валидация идентификаторов (после обработки всех полей в строке)
                    // Это пример, логика определения "существующей записи" должна быть уточнена
                    // Например, запрос к БД для проверки уникальности идентификаторов
                    const identifierFields = Object.entries(mappingRules)
                        .filter(([_, rule]) => rule.is_identifier)
                        .map(([fieldName, _]) => fieldName);
                    if (identifierFields.length > 0) {
                        // Здесь должна быть логика проверки, существует ли уже запись с такими идентификаторами
                        // const existingEntity = await YourModel.findOne({ where: pick(processedRow, identifierFields) });
                        // if (existingEntity) {
                        //    hasIdentifierConflict = true;
                        //    logger.warn(`Row ${i+1}: Identifier conflict for fields ${identifierFields.join(', ')} with values ${identifierFields.map(f => processedRow[f]).join(', ')}`);
                        // }
                    }
                    if (rowErrors.length > 0) {
                        processingStats.failedRows++;
                        processingStats.errorData.push({ original_row_index: i + 1, original_data: row, errors: rowErrors, processed_data_attempt: processedRow });
                    }
                    else {
                        processingStats.successfullyProcessedRows++;
                        processingStats.processedData.push(processedRow);
                        // Добавляем в sample_rows только успешно обработанные строки, если еще не набрали достаточно
                        if (processingStats.sample_rows.length < 10) { // Ограничение на количество строк в предпросмотре
                            processingStats.sample_rows.push(processedRow);
                        }
                    }
                } // конец цикла по dataRows
                logger.info(`[ImportService.uploadAndProcessImportFile] File processing finished for import ID ${importId}. Total: ${processingStats.totalRows}, Success: ${processingStats.successfullyProcessedRows}, Failed: ${processingStats.failedRows}`);
                if (processingStats.failedRows > 0) {
                    logger.info(`[ImportService.uploadAndProcessImportFile] Details of rowErrors for rows with failures (sample):`);
                    processingStats.errorData.slice(0, 5).forEach((errItem) => {
                        logger.info(`  Row index ${errItem.original_row_index}: Errors: ${JSON.stringify(errItem.errors)}`);
                    });
                }
                if (processingStats.parse_errors.length > 0) {
                    importRecord.status = 'processing_failed';
                    importRecord.status_details = `Ошибка парсинга файла: ${processingStats.parse_errors.join('; ')}`;
                }
                else if (processingStats.failedRows > 0 && processingStats.successfullyProcessedRows === 0) {
                    importRecord.status = 'processing_failed';
                    importRecord.status_details = `Все ${processingStats.totalRows} строк не удалось обработать. См. детали ошибок.`;
                }
                else if (processingStats.failedRows > 0) { // Частичный успех
                    importRecord.status = 'preview_ready'; // или 'processing_partial_success' если такой статус есть
                    importRecord.status_details = `Обработано ${processingStats.successfullyProcessedRows} из ${processingStats.totalRows}. Ошибок: ${processingStats.failedRows}.`;
                }
                else if (processingStats.successfullyProcessedRows > 0) { // Полный успех
                    importRecord.status = 'preview_ready';
                    importRecord.status_details = `Все ${processingStats.successfullyProcessedRows} строки успешно обработаны и готовы к предпросмотру.`;
                }
                else if (processingStats.totalRows === 0 && processingStats.parse_errors.length === 0) { // Файл пуст, но без ошибок парсинга
                    importRecord.status = 'preview_ready'; // или 'processing_empty'
                    importRecord.status_details = 'Файл не содержит данных для импорта.';
                }
                else { // Непредвиденный случай
                    importRecord.status = 'processing_failed';
                    importRecord.status_details = 'Обработка завершилась с неопределенным результатом.';
                }
                importRecord.rows_successfully_previewed = processingStats.successfullyProcessedRows;
                importRecord.rows_failed_preview = processingStats.failedRows;
                importRecord.processing_finished_at = new Date();
                // Сохранение результатов обработки (JSON) в S3
                if (processingStats.processedData.length > 0) {
                    processedDataS3Key = `import-files/client_${client.id}/import_${importRecord.id}/processed_data_${Date.now()}.json`;
                    const processedDataUploadParams = {
                        Bucket: S3_BUCKET_NAME,
                        Key: processedDataS3Key,
                        Body: JSON.stringify(processingStats.processedData),
                        ContentType: 'application/json'
                    };
                    await new Upload({ client: s3Client, params: processedDataUploadParams }).done();
                    importRecord.s3_key_processed_data = processedDataS3Key;
                    logger.info(`[ImportService.uploadAndProcessImportFile] Successfully uploaded processed data to S3: ${processedDataS3Key}`);
                }
                if (processingStats.errorData.length > 0) {
                    errorDataS3Key = `import-files/client_${client.id}/import_${importRecord.id}/error_data_${Date.now()}.json`;
                    const errorDataUploadParams = {
                        Bucket: S3_BUCKET_NAME,
                        Key: errorDataS3Key,
                        Body: JSON.stringify(processingStats.errorData),
                        ContentType: 'application/json'
                    };
                    await new Upload({ client: s3Client, params: errorDataUploadParams }).done();
                    importRecord.s3_key_error_data = errorDataS3Key;
                    logger.info(`[ImportService.uploadAndProcessImportFile] Successfully uploaded error data to S3: ${errorDataS3Key}`);
                }
                await importRecord.save({ transaction: processingTransaction });
                processingSuccessful = true; // Флаг, что основная логика обработки и сохранения результатов прошла успешно
                logger.info(`[ImportService.uploadAndProcessImportFile] Import record ID ${importId} updated after processing. Status: ${importRecord.status}.`);
            }); // --- Конец транзакции для обработки ---
        }
        catch (processingError) {
            logger.error(`[ImportService.uploadAndProcessImportFile] Error during file processing or final DB update for import ID ${importId}: ${processingError.message}`, { error: processingError, importId });
            // Попытка обновить статус ImportHistory на 'processing_failed' вне транзакции, если она откатилась
            try {
                // Получаем запись снова, так как importRecord мог быть изменен или неактуален
                const currentRecord = await ImportHistory.findByPk(importId);
                if (currentRecord) {
                    currentRecord.status = 'processing_failed';
                    currentRecord.status_details = `Критическая ошибка при обработке: ${processingError.message.substring(0, 250)}`;
                    currentRecord.processing_finished_at = new Date();
                    if (!currentRecord.processing_started_at && importRecord && importRecord.processing_started_at) {
                        // если processing_started_at не установился из-за ранней ошибки в транзакции, но мы его запомнили
                        currentRecord.processing_started_at = importRecord.processing_started_at;
                    }
                    else if (!currentRecord.processing_started_at) {
                        currentRecord.processing_started_at = new Date(); // fallback
                    }
                    await currentRecord.save();
                    logger.info(`[ImportService.uploadAndProcessImportFile] Import ID ${importId} status updated to 'processing_failed' after catching processing error.`);
                }
            }
            catch (statusUpdateError) {
                logger.error(`[ImportService.uploadAndProcessImportFile] CRITICAL: Failed to update import status to 'processing_failed' for import ID ${importId} after a processing error: ${statusUpdateError.message}`, { statusUpdateError });
            }
            // Попытка удалить частично загруженные результаты обработки (JSON) из S3, если они были созданы до ошибки
            if (processedDataS3Key && !processingSuccessful) { // Если ключ есть, но основной успех не достигнут
                try {
                    logger.warn(`[ImportService.uploadAndProcessImportFile] Rolling back S3 upload of processed data due to error. Deleting ${processedDataS3Key}`);
                    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: processedDataS3Key }));
                }
                catch (s3DeleteError) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Failed to delete ${processedDataS3Key} from S3 during error rollback: ${s3DeleteError.message}`);
                }
            }
            if (errorDataS3Key && !processingSuccessful) {
                try {
                    logger.warn(`[ImportService.uploadAndProcessImportFile] Rolling back S3 upload of error data due to error. Deleting ${errorDataS3Key}`);
                    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: errorDataS3Key }));
                }
                catch (s3DeleteError) {
                    logger.error(`[ImportService.uploadAndProcessImportFile] Failed to delete ${errorDataS3Key} from S3 during error rollback: ${s3DeleteError.message}`);
                }
            }
            throw processingError; // Перебрасываем ошибку этапа обработки
        }
        // После успешного завершения обоих этапов (загрузки и обработки)
        // Возвращаем финальное состояние importRecord (которое было обновлено в транзакции обработки)
        // и статистику обработки.
        const finalImportRecord = await ImportHistory.findByPk(importId, {
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'user' },
                { model: FieldMapping, as: 'fieldMapping' }
            ]
        });
        return {
            importRecord: finalImportRecord,
            statistics: {
                total_rows_in_file: processingStats.totalRows,
                rows_successfully_previewed: finalImportRecord?.rows_successfully_previewed,
                rows_failed_preview: finalImportRecord?.rows_failed_preview,
                sample_rows: processingStats.sample_rows, // Возвращаем семпл который был сформирован
                file_headers: processingStats.fileHeaders, // Возвращаем заголовки файла
                // Если нужны ссылки на S3 для данных:
                // processed_data_s3_key: finalImportRecord.s3_key_processed_data,
                // error_data_s3_key: finalImportRecord.s3_key_error_data,
            }
        };
    }
    // Добавляем новый статический метод
    static async getSystemFieldDefinitions() {
        // Типы должны соответствовать тем, что используются в switch далее и в БД:
        // DATETIME, DATE, INTEGER, FLOAT, DECIMAL, STRING, TEXT
        return [
            // Поля из schema.sql (с корректными типами)
            { name: 'client_id', type: 'INTEGER' }, // Связь с Client
            { name: 'session_id', type: 'INTEGER' }, // Связь с ImportHistory (ID сессии импорта)
            { name: 'customer_id', type: 'STRING' },
            { name: 'order_number', type: 'STRING' },
            { name: 'order_date', type: 'DATETIME' },
            { name: 'delivery_date', type: 'DATETIME' }, // Исправлено с DATE на DATETIME (SQL: timestamp)
            { name: 'product', type: 'STRING' },
            { name: 'article_number', type: 'STRING' },
            { name: 'category', type: 'STRING' },
            { name: 'brand', type: 'STRING' },
            { name: 'quantity', type: 'INTEGER' },
            { name: 'revenue', type: 'FLOAT' }, // Исправлено с DECIMAL на FLOAT (SQL: float)
            { name: 'cost_price', type: 'FLOAT' }, // Исправлено с DECIMAL на FLOAT (SQL: float)
            { name: 'name', type: 'STRING' }, // Может быть ФИО целиком
            { name: 'telephone', type: 'STRING' },
            { name: 'birthday', type: 'DATE' },
            { name: 'city', type: 'STRING' },
            { name: 'subdivision', type: 'STRING' },
            { name: 'pick_up_point', type: 'STRING' },
            { name: 'car_brand', type: 'STRING' },
            { name: 'car_model', type: 'STRING' },
            { name: 'entry_date', type: 'DATETIME' }, // Добавлено (SQL: timestamp)
            { name: 'entry_user', type: 'STRING' }, // Добавлено (SQL: varchar)
            // Поля, которые были в предыдущем списке, но отсутствуют в предоставленном schema.sql.
            // Решите, нужны ли они, и если да, то с какими типами.
            // { name: 'first_name', type: 'STRING' }, 
            // { name: 'last_name', type: 'STRING' }, // В schema.sql есть 'name', но нет 'last_name' отдельно.
            // Если 'name' это ФИО, то 'last_name' не нужен, иначе нужно добавить last_name в schema и сюда.
            // { name: 'middle_name', type: 'STRING' },
            // { name: 'email', type: 'STRING' },
            // { name: 'address', type: 'STRING' },
            // { name: 'car_year', type: 'INTEGER' },
            // { name: 'vin_number', type: 'STRING' },
        ];
    }
    static _applyProcessingFunction(value, functionName, params) {
        const funcParams = params || {};
        let initialStringValue = null;
        // Определяем initialStringValue более явно
        if (typeof value === 'string' || value instanceof String) {
            initialStringValue = String(value);
        }
        else if (value instanceof Date) {
            // Date обрабатывается специально в EXTRACT_DATETIME/parseDate
            // Для других функций можно взять его ISO представление или другое строковое представление
            // initialStringValue = value.toISOString(); // Например
        }
        else if (value !== null && value !== undefined) {
            // Попытка привести другие типы (например, число) к строке
            initialStringValue = String(value);
        }
        logger.debug(`[ImportService.applyProcFunc][${functionName}] Called with value (type ${typeof value}): '${value}', initialStringValue: '${initialStringValue}', params: %o`, funcParams);
        switch (functionName) {
            case 'toUpperCase':
                // Если initialStringValue есть, используем его. Иначе, если value не null/undefined, приводим к строке. Иначе null.
                return initialStringValue ? initialStringValue.toUpperCase() : (value === null || value === undefined ? null : String(value).toUpperCase());
            case 'toLowerCase':
                return initialStringValue ? initialStringValue.toLowerCase() : (value === null || value === undefined ? null : String(value).toLowerCase());
            case 'trim':
                return initialStringValue ? initialStringValue.trim() : (value === null || value === undefined ? null : String(value).trim());
            case 'EXTRACT_DATETIME':
            case 'parseDate':
                if (value instanceof Date) {
                    logger.debug(`[ImportService.applyProcFunc][${functionName}] Input is already a Date object. Returning ISO string: ${value.toISOString()}`);
                    return value.toISOString();
                }
                // На этом этапе initialStringValue содержит либо строку из value, либо null.
                if (initialStringValue === null || initialStringValue.trim() === '') {
                    logger.debug(`[ImportService.applyProcFunc][${functionName}] Input value is not a non-empty string for date parsing. Original value: '${value}'. Returning null.`);
                    return null;
                }
                // Теперь initialStringValue - это гарантированно непустая строка.
                try {
                    const originalStr = initialStringValue;
                    logger.debug(`[ImportService.applyProcFunc][${functionName}] Processing string for date parsing: '${originalStr}'`);
                    const targetFormat = 'DD.MM.YYYY HH:mm:ss';
                    const flexibleHourFormat = 'DD.MM.YYYY H:mm:ss';
                    const alternativePointFormat = 'YYYY.MM.DD H.mm.ss';
                    const alternativePointFormatWithTwoDigitHour = 'YYYY.MM.DD HH.mm.ss';
                    const dateTimeRegex = /от\s+(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})/;
                    let match = originalStr.match(dateTimeRegex);
                    if (match && match[1]) {
                        const extractedDateStr = match[1];
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('от DD.MM.YYYY H(H):mm:ss') matched. Extracted: '${extractedDateStr}'`);
                        let parsedDate = moment(extractedDateStr, flexibleHourFormat, true);
                        if (!parsedDate.isValid()) {
                            logger.debug(`[ImportService.applyProcFunc][${functionName}] moment with format '${flexibleHourFormat}' failed. Trying '${targetFormat}'.`);
                            parsedDate = moment(extractedDateStr, targetFormat, true);
                        }
                        if (parsedDate.isValid()) {
                            const isoDate = parsedDate.toISOString();
                            logger.info(`[ImportService.applyProcFunc][${functionName}] Successfully parsed (regex 'от ...') '${extractedDateStr}' to ISO: ${isoDate}`);
                            return isoDate;
                        }
                        else {
                            logger.warn(`[ImportService.applyProcFunc][${functionName}] moment failed to parse extracted string (regex 'от ...') '${extractedDateStr}' with formats '${flexibleHourFormat}' and '${targetFormat}'.`);
                        }
                    }
                    else {
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('от DD.MM.YYYY H(H):mm:ss') did not match.`);
                    }
                    const directDateTimeRegex = /^(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2})$/;
                    match = originalStr.match(directDateTimeRegex);
                    if (match && match[1]) {
                        const extractedDateStr = match[1];
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('DD.MM.YYYY H(H):mm:ss') matched. Extracted: '${extractedDateStr}'`);
                        let parsedDate = moment(extractedDateStr, flexibleHourFormat, true);
                        if (!parsedDate.isValid()) {
                            logger.debug(`[ImportService.applyProcFunc][${functionName}] moment with format '${flexibleHourFormat}' failed. Trying '${targetFormat}'.`);
                            parsedDate = moment(extractedDateStr, targetFormat, true);
                        }
                        if (parsedDate.isValid()) {
                            const isoDate = parsedDate.toISOString();
                            logger.info(`[ImportService.applyProcFunc][${functionName}] Successfully parsed (direct regex) '${extractedDateStr}' to ISO: ${isoDate}`);
                            return isoDate;
                        }
                        else {
                            logger.warn(`[ImportService.applyProcFunc][${functionName}] moment failed to parse extracted string (direct regex) '${extractedDateStr}' with formats '${flexibleHourFormat}' and '${targetFormat}'.`);
                        }
                    }
                    else {
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('DD.MM.YYYY H(H):mm:ss') did not match.`);
                    }
                    const pointDateTimeRegex = /^(\d{4}\.\d{2}\.\d{2}\s+\d{1,2}\.\d{2}\.\d{2})$/;
                    match = originalStr.match(pointDateTimeRegex);
                    if (match && match[1]) {
                        const extractedDateStr = match[1];
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('YYYY.MM.DD H(H).mm.ss') matched. Extracted: '${extractedDateStr}'`);
                        let parsedDate = moment(extractedDateStr, alternativePointFormat, true);
                        if (!parsedDate.isValid()) {
                            logger.debug(`[ImportService.applyProcFunc][${functionName}] moment with format '${alternativePointFormat}' failed. Trying '${alternativePointFormatWithTwoDigitHour}'.`);
                            parsedDate = moment(extractedDateStr, alternativePointFormatWithTwoDigitHour, true);
                        }
                        if (parsedDate.isValid()) {
                            const isoDate = parsedDate.toISOString();
                            logger.info(`[ImportService.applyProcFunc][${functionName}] Successfully parsed (point regex) '${extractedDateStr}' to ISO: ${isoDate}`);
                            return isoDate;
                        }
                        else {
                            logger.warn(`[ImportService.applyProcFunc][${functionName}] moment failed to parse extracted string (point regex) '${extractedDateStr}' with formats '${alternativePointFormat}' and '${alternativePointFormatWithTwoDigitHour}'.`);
                        }
                    }
                    else {
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Regex ('YYYY.MM.DD H(H).mm.ss') did not match.`);
                    }
                    if (funcParams.format && typeof funcParams.format === 'string' && funcParams.format.trim() !== '') {
                        const customFormat = funcParams.format.trim();
                        logger.debug(`[ImportService.applyProcFunc][${functionName}] Trying to parse with custom format from params: '${customFormat}' for string: '${initialStringValue}'`);
                        const parsedDate = moment(initialStringValue, customFormat, true);
                        if (parsedDate.isValid()) {
                            const isoDate = parsedDate.toISOString();
                            logger.info(`[ImportService.applyProcFunc][${functionName}] Successfully parsed with custom format '${customFormat}' to ISO: ${isoDate}`);
                            return isoDate;
                        }
                        else {
                            logger.warn(`[ImportService.applyProcFunc][${functionName}] Failed to parse with custom format '${customFormat}' for string: '${initialStringValue}'.`);
                        }
                    }
                    const genericParsedDate = moment(initialStringValue, moment.ISO_8601, false);
                    if (genericParsedDate.isValid()) {
                        const isoDate = genericParsedDate.toISOString();
                        return isoDate;
                    }
                    // ... остальные ветки ...
                }
                catch (dateError) {
                    logger.error(`[ImportService.applyProcFunc][${functionName}] Error during date parsing for value '${initialStringValue}': ${dateError.message}`, { error: dateError });
                    return null;
                }
                logger.warn(`[ImportService.applyProcFunc][${functionName}] All parsing attempts failed for string: '${initialStringValue}'. Returning null.`);
                return null; // Явный return, если все попытки парсинга провалились
            default:
                logger.warn(`[ImportService.applyProcFunc] Unknown processing function: ${functionName} for value (type ${typeof value}) '${value}'.`);
                if (value instanceof Date) {
                    logger.debug(`[ImportService.applyProcFunc][default] Value is Date, returning ISO string: ${value.toISOString()}`);
                    return value.toISOString();
                }
                return (value === null || value === undefined) ? null : String(value);
        }
    }
}
// Helper function to convert stream to buffer, needed for S3 GetObjectCommand
const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
});
export default ImportService;
