// fieldMappingService.js
const { FieldMapping, Client, sequelize } = require('../../shared/models');
const { s3Client, S3_BUCKET_NAME } = require('../config/s3');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class FieldMappingService {
    /**
     * Get all field mappings, optionally filtered by client_id.
     * @param {number} [client_id] - Optional. client_id to filter mappings.
     * @returns {Promise<Array<FieldMapping>>} - An array of field mapping objects.
     * @throws {Error} If there's an error during the database query.
     */
    static async getAllMappings(client_id) {
        logger.debug('[FieldMappingService.getAllMappings] Request to get all mappings. Filter client_id: %s', client_id);
        try {
            let where = {};
            if (client_id != null) {
                where = { client_id: client_id };
                logger.debug('[FieldMappingService.getAllMappings] Filtering mappings by client_id: %s', client_id);
            } else {
                logger.debug('[FieldMappingService.getAllMappings] Not filtering by client_id. Fetching all mappings.');
            }
            
            const mappings = await FieldMapping.findAll({
                where,
                include: [{
                    model: Client,
                    as: 'client',
                    attributes: ['name']
                }],
                order: [['created_at', 'DESC']]
            });
            logger.info('[FieldMappingService.getAllMappings] Found %d mappings.', mappings.length);
            return mappings;
        } catch (error) {
            logger.error('[FieldMappingService.getAllMappings] Failed to get mappings. Error: %s', error.message, { error });
            throw error;
        }
    }

    /**
     * Get all field mappings for a specific client.
     * @param {number} clientId - The ID of the client.
     * @returns {Promise<Array<FieldMapping>>} - An array of field mapping objects for the client.
     * @throws {Error} If there's an error during the database query.
     */
    static async getMappingsByClientId(clientId) {
        logger.debug('[FieldMappingService.getMappingsByClientId] Request to get mappings by client ID: %s', clientId);
        try {
            const mappings = await FieldMapping.findAll({
                where: { client_id: clientId },
                include: [{
                    model: Client,
                    as: 'client',
                    attributes: ['name']
                }],
                order: [['created_at', 'DESC']]
            });
            logger.info('[FieldMappingService.getMappingsByClientId] Found %d mappings for client ID %s.', mappings.length, clientId);
            return mappings;
        } catch (error) {
            logger.error('[FieldMappingService.getMappingsByClientId] Failed to get mappings for client ID %s. Error: %s', clientId, error.message, { error });
            throw error;
        }
    }

    /**
     * Get a specific field mapping by its ID.
     * @param {number} mappingId - The ID of the field mapping.
     * @returns {Promise<FieldMapping|null>} The field mapping object or null if not found.
     * @throws {Error} If there's an error during the database query.
     */
    static async getMappingById(mappingId) {
        logger.debug('[FieldMappingService.getMappingById] Request to get mapping by ID: %s', mappingId);
        try {
            const mapping = await FieldMapping.findByPk(mappingId, {
                include: [{
                    model: Client,
                    as: 'client',
                    attributes: ['name']
                }]
            });
            
            if (!mapping) {
                logger.warn('[FieldMappingService.getMappingById] Mapping not found for ID: %s', mappingId);
                return null;
            }
            logger.info('[FieldMappingService.getMappingById] Mapping found for ID %s: %o', mappingId, {id: mapping.id, name: mapping.name});
            return mapping;
        } catch (error) {
            logger.error('[FieldMappingService.getMappingById] Failed to get mapping by ID %s. Error: %s', mappingId, error.message, { error });
            throw error;
        }
    }

    /**
     * Create a new field mapping.
     * @param {object} mappingData - Data for the new mapping.
     * @param {string} mappingData.name - Name of the mapping.
     * @param {object} mappingData.mapping - The mapping object itself.
     * @param {number} [mappingData.client_id] - Optional. ID of the client.
     * @param {string} [mappingData.sample_data_url] - Optional. URL to a sample data file.
     * @returns {Promise<FieldMapping>} The created field mapping object, including client name.
     * @throws {Error} If client_id is provided but client not found, or if there's a database error.
     */
    static async createMapping({ name, mapping, client_id, sample_data_url }) {
        const mappingDataForLog = { name, client_id, sample_data_url, mapping_keys: mapping ? Object.keys(mapping) : null };    
        logger.debug('[FieldMappingService.createMapping] Attempting to create mapping. Data: %o', mappingDataForLog);
        let newMappingWithClient;

        try {
            await sequelize.transaction(async (t) => {
                if (client_id) {
                    const clientExists = await Client.findByPk(client_id, { transaction: t });
                    if (!clientExists) {
                        logger.warn('[FieldMappingService.createMapping] Client with ID %s provided for mapping does not exist.', client_id);
                        const error = new Error(`Клиент с ID ${client_id} не найден.`);
                        error.statusCode = 400;
                        throw error;
                    }
                }

                const newMapping = await FieldMapping.create({
                    name,
                    mapping,
                    client_id,
                    sample_data_url
                }, { transaction: t });
                
                logger.info('[FieldMappingService.createMapping] Mapping created successfully. ID: %s, Name: %s, ClientID: %s', newMapping.id, newMapping.name, newMapping.client_id);
                
                newMappingWithClient = await FieldMapping.findByPk(newMapping.id, {
                    include: [{ model: Client, as: 'client', attributes: ['name']}],
                    transaction: t
                });
            });
            return newMappingWithClient;
        } catch (error) {
            logger.error('[FieldMappingService.createMapping] Failed to create mapping. Error: %s', error.message, {
                error: error,
                requestBody: mappingDataForLog,
                finalClientIdUsed: client_id
            });
            throw error; 
        }
    }

    /**
     * Update an existing field mapping.
     * @param {number} mappingId - The ID of the mapping to update.
     * @param {object} updateData - Data to update.
     * @param {string} [updateData.name] - New name of the mapping.
     * @param {object} [updateData.mapping] - New mapping object.
     * @param {number} [updateData.client_id] - New client ID for the mapping.
     * @param {string} [updateData.sample_data_url] - New sample data URL.
     * @param {number} [requesting_client_id] - client_id of the user making the request, for authorization.
     * @returns {Promise<FieldMapping|null>} The updated field mapping object or null if not found.
     * @throws {Error} If client_id is provided but client not found, or if there's a database/authorization error.
     */
    static async updateMapping(mappingId, { name, mapping, client_id, sample_data_url }, requesting_client_id) {
        const updateDataForLog = { name, client_id, sample_data_url, mapping_keys: mapping ? Object.keys(mapping) : null };
        logger.debug('[FieldMappingService.updateMapping] Attempting to update mapping ID %s. Data: %o', mappingId, updateDataForLog);
        let updatedMappingWithClient;

        try {
            await sequelize.transaction(async (t) => {
                const existingMapping = await FieldMapping.findByPk(mappingId, { transaction: t });
                if (!existingMapping) {
                    logger.warn('[FieldMappingService.updateMapping] Mapping with ID %s not found for update.', mappingId);
                    // Не бросаем ошибку, чтобы внешний try/catch обработал и вернул null/404
                    // Однако, если мы внутри транзакции, то findByPk не найдет и это нормально.
                    // Ошибка будет брошена если мы пытаемся сохранить null, так что это безопасно.
                    // Можно и ошибку бросить, тогда контроллер вернет 404.
                    // Для консистентности с delete, бросим ошибку.
                    const notFoundError = new Error('Маппинг не найден');
                    notFoundError.statusCode = 404;
                    throw notFoundError;
                }

                // Авторизация на уровне сервиса
                if (requesting_client_id != null && existingMapping.client_id !== requesting_client_id) {
                    logger.warn('[FieldMappingService.updateMapping] Forbidden: User with client_id %s cannot update mapping ID %s (client_id %s).', requesting_client_id, mappingId, existingMapping.client_id);
                    const error = new Error('Нет доступа к обновлению этого маппинга');
                    error.statusCode = 403;
                    throw error;
                }

                // Если в запросе на обновление указан client_id, проверяем его существование
                if (client_id != null && client_id !== existingMapping.client_id) { 
                    const clientExists = await Client.findByPk(client_id, { transaction: t });
                    if (!clientExists) {
                        logger.warn('[FieldMappingService.updateMapping] Client with ID %s for update does not exist.', client_id);
                        const error = new Error(`Клиент с ID ${client_id} не найден.`);
                        error.statusCode = 400;
                        throw error;
                    }
                    existingMapping.client_id = client_id;
                }

                if (name !== undefined) existingMapping.name = name;
                if (mapping !== undefined) existingMapping.mapping = mapping;    
                // Обработка sample_data_url: если он явно передан (даже как null), обновляем
                if (Object.prototype.hasOwnProperty.call({ name, mapping, client_id, sample_data_url }, 'sample_data_url')) {
                    existingMapping.sample_data_url = sample_data_url;
                }

                await existingMapping.save({ transaction: t });
                logger.info('[FieldMappingService.updateMapping] Mapping ID %s updated successfully.', mappingId);
                
                updatedMappingWithClient = await FieldMapping.findByPk(mappingId, {
                    include: [{ model: Client, as: 'client', attributes: ['name']}],
                    transaction: t
                });
            });
            return updatedMappingWithClient;
        } catch (error) {
            // Если это наша ошибка 404/403, она уже залогирована и имеет statusCode
            if (!error.statusCode) {
                logger.error('[FieldMappingService.updateMapping] Failed to update mapping ID %s. Error: %s', mappingId, error.message, { error, updateDataForLog });
            }
            throw error;
        }
    }

    /**
     * Delete a field mapping.
     * @param {number} mappingId - The ID of the mapping to delete.
     * @param {number} [requesting_client_id] - client_id of the user making the request, for authorization.
     * @returns {Promise<boolean>} True if deleted, false if not found.
     * @throws {Error} If there's a database or authorization error.
     */
    static async deleteMapping(mappingId, requesting_client_id) {
        logger.debug('[FieldMappingService.deleteMapping] Attempting to delete mapping ID %s by user with client_id %s', mappingId, requesting_client_id);
        
        try {
            await sequelize.transaction(async (t) => {
                const mapping = await FieldMapping.findByPk(mappingId, { transaction: t });

                if (!mapping) {
                    logger.warn('[FieldMappingService.deleteMapping] Mapping with ID %s not found for deletion.', mappingId);
                    // Бросаем ошибку, чтобы транзакция откатилась и контроллер вернул 404
                    const notFoundError = new Error('Маппинг не найден');
                    notFoundError.statusCode = 404;
                    throw notFoundError;
                }

                // Авторизация: пользователь с client_id может удалять только свои маппинги
                if (requesting_client_id != null && mapping.client_id !== requesting_client_id) {
                    logger.warn('[FieldMappingService.deleteMapping] Forbidden: User with client_id %s cannot delete mapping ID %s (client_id %s).', requesting_client_id, mappingId, mapping.client_id);
                    const error = new Error('Нет доступа к удалению этого маппинга');
                    error.statusCode = 403;
                    throw error;
                }

                // TODO: Если sample_data_url существует, нужно запланировать удаление из S3.
                // Это лучше делать перед destroy, чтобы если удаление из S3 не удалось, не удалять запись.
                // Либо, если удаление из S3 не критично для бизнес-логики, можно сделать после destroy.
                // Пока просто удаляем запись из БД.

                await mapping.destroy({ transaction: t });
                logger.info('[FieldMappingService.deleteMapping] Mapping ID %s deleted successfully.', mappingId);
            });
            return true;
        } catch (error) {
            if (!error.statusCode) { // Если это не наша кастомная ошибка со статусом
                 logger.error('[FieldMappingService.deleteMapping] Failed to delete mapping ID %s. Error: %s', mappingId, error.message, { error });
            }
            throw error;
        }
    }

    /**
     * Upload a sample file for a field mapping to S3 and update the mapping.
     * @param {number} mappingId - The ID of the mapping.
     * @param {object} file - The file object (from multer or similar).
     * @param {Buffer} file.buffer - File content.
     * @param {string} file.originalname - Original name of the file.
     * @param {number} [requesting_client_id] - client_id of the user making the request, for authorization.
     * @returns {Promise<FieldMapping|null>} The updated field mapping object or null if mapping not found.
     * @throws {Error} If S3 upload fails, or DB update fails, or authorization error.
     */
    static async uploadSampleFile(mappingId, file, requesting_client_id) {
        logger.debug('[FieldMappingService.uploadSampleFile] Attempting to upload sample for mapping ID %s. File: %s. Requesting client_id: %s',
            mappingId, file ? file.originalname : 'No file', requesting_client_id);

        if (!file) {
            logger.warn('[FieldMappingService.uploadSampleFile] No file provided for mapping ID %s.', mappingId);
            const error = new Error('Файл не предоставлен.');
            error.statusCode = 400;
            throw error;
        }

        const fileExtension = file.originalname.split('.').pop();
        const s3Key = `sample-data/mapping-${mappingId}-${uuidv4()}.${fileExtension}`;
        let s3UploadSuccessful = false;
        let updatedMappingWithClient;

        try {
            await sequelize.transaction(async (t) => {
                const mapping = await FieldMapping.findByPk(mappingId, { transaction: t });
                if (!mapping) {
                    logger.warn('[FieldMappingService.uploadSampleFile] Mapping ID %s not found.', mappingId);
                    const error = new Error('Маппинг не найден');
                    error.statusCode = 404;
                    throw error; 
                }

                // Авторизация
                if (requesting_client_id != null && mapping.client_id !== requesting_client_id) {
                    logger.warn('[FieldMappingService.uploadSampleFile] Forbidden: User with client_id %s cannot upload sample for mapping ID %s (client_id %s).',
                        requesting_client_id, mappingId, mapping.client_id);
                    const error = new Error('Нет доступа к этому маппингу для загрузки образца');
                    error.statusCode = 403;
                    throw error;
                }

                // 1. Загружаем файл в S3
                const uploadParams = {
                    Bucket: S3_BUCKET_NAME,
                    Key: s3Key,
                    Body: file.buffer,
                    ContentType: file.mimetype
                };
                await s3Client.send(new PutObjectCommand(uploadParams));
                s3UploadSuccessful = true;
                logger.info('[FieldMappingService.uploadSampleFile] File %s uploaded to S3 for mapping ID %s. S3 Key: %s', 
                    file.originalname, mappingId, s3Key);

                // 2. Обновляем запись в БД
                // Если у маппинга уже был sample_data_url, старый файл в S3 останется "осиротевшим".
                // TODO: Рассмотреть удаление старого S3 файла, если он был.
                mapping.sample_data_url = s3Key;
                await mapping.save({ transaction: t });
                logger.info('[FieldMappingService.uploadSampleFile] Mapping ID %s updated with S3 key: %s', mappingId, s3Key);

                updatedMappingWithClient = await FieldMapping.findByPk(mappingId, {
                    include: [{ model: Client, as: 'client', attributes: ['name'] }],
                    transaction: t
                });
            });
            return updatedMappingWithClient;

        } catch (error) {
            logger.error('[FieldMappingService.uploadSampleFile] Error during upload/DB update for mapping ID %s. Error: %s', 
                mappingId, error.message, { error, s3KeyIfGenerated: s3Key, fileName: file.originalname, s3UploadSuccessful });

            // Компенсирующая транзакция: если файл был загружен в S3, но произошла ошибка в БД (или другая ошибка после загрузки S3)
            if (s3UploadSuccessful) {
                logger.warn('[FieldMappingService.uploadSampleFile] DB operation failed after S3 upload for key %s. Attempting to delete from S3.', s3Key);
                try {
                    const deleteParams = { Bucket: S3_BUCKET_NAME, Key: s3Key };
                    await s3Client.send(new DeleteObjectCommand(deleteParams));
                    logger.info('[FieldMappingService.uploadSampleFile] Successfully deleted orphaned S3 file: %s', s3Key);
                } catch (s3DeleteError) {
                    logger.error('[FieldMappingService.uploadSampleFile] CRITICAL: Failed to delete S3 file %s after DB error. Manual cleanup required. S3 Delete Error: %s',
                        s3Key, s3DeleteError.message, { error: s3DeleteError });
                    // Эту ошибку не перебрасываем, чтобы исходная ошибка была главной
                }
            }
            throw error; // Перебрасываем исходную ошибку
        }
    }

    /**
     * Get a signed URL for a sample data file stored in S3, or directly for a given S3 key.
     * @param {object} params - Parameters object.
     * @param {number} [params.mappingId] - Optional. The ID of the mapping. Used if s3Key is not provided.
     * @param {string} [params.s3Key] - Optional. Direct S3 key. Takes precedence over mappingId.
     * @param {number} [params.requesting_client_id] - client_id of the user making the request, for authorization if using mappingId.
     * @param {number} [params.expiresIn=3600] - URL expiration time in seconds.
     * @returns {Promise<string|null>} The signed URL or null if resource not found or access denied.
     * @throws {Error} If S3 error or authorization error.
     */
    static async getSampleFileSignedUrl({ mappingId, s3Key, requesting_client_id, expiresIn = 3600 }) {
        logger.debug('[FieldMappingService.getSampleFileSignedUrl] Request for signed URL. Mapping ID: %s, S3 Key: %s, ExpiresIn: %s, Requesting client_id: %s',
            mappingId, s3Key, expiresIn, requesting_client_id);

        let targetS3Key = s3Key;

        if (!targetS3Key && mappingId) {
            const mapping = await FieldMapping.findByPk(mappingId);
            if (!mapping) {
                logger.warn('[FieldMappingService.getSampleFileSignedUrl] Mapping ID %s not found when s3Key not provided.', mappingId);
                return null;
            }

            // Authorization if using mappingId
            if (requesting_client_id != null && mapping.client_id !== requesting_client_id) {
                logger.warn('[FieldMappingService.getSampleFileSignedUrl] Forbidden: User with client_id %s cannot access sample for mapping ID %s (client_id %s).',
                    requesting_client_id, mappingId, mapping.client_id);
                const error = new Error('Нет доступа к образцу данных этого маппинга');
                error.statusCode = 403;
                throw error;
            }

            if (!mapping.sample_data_url) {
                logger.warn('[FieldMappingService.getSampleFileSignedUrl] No sample_data_url found for mapping ID %s.', mappingId);
                return null;
            }
            targetS3Key = mapping.sample_data_url;
        } else if (!targetS3Key) {
            logger.warn('[FieldMappingService.getSampleFileSignedUrl] Neither s3Key nor mappingId provided.');
            return null;
        }
        
        if (!S3_BUCKET_NAME) {
            logger.error('[FieldMappingService.getSampleFileSignedUrl] S3_BUCKET_NAME is not configured.');
            throw new Error('S3_BUCKET_NAME не настроен на сервере.');
        }

        try {
            // Сначала проверяем существование файла в S3
            try {
                const headCommand = new HeadObjectCommand({ Bucket: S3_BUCKET_NAME, Key: targetS3Key });
                await s3Client.send(headCommand);
            } catch (headError) {
                if (headError.name === 'NotFound' || headError.name === 'NoSuchKey') {
                    logger.warn('[FieldMappingService.getSampleFileSignedUrl] S3 key %s not found in bucket.', targetS3Key);
                    return null;
                }
                throw headError;
            }

            // Если файл существует, генерируем подписанный URL
            const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: targetS3Key });
            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
            logger.info('[FieldMappingService.getSampleFileSignedUrl] Signed URL generated for S3 key %s (Mapping ID: %s).',
                targetS3Key, mappingId || 'N/A (direct key)');
            return signedUrl;
        } catch (error) {
            logger.error('[FieldMappingService.getSampleFileSignedUrl] S3 error for key %s (Mapping ID: %s). Error: %s',
                targetS3Key, mappingId || 'N/A (direct key)', error.message, { error });
            throw error;
        }
    }
}

module.exports = FieldMappingService; 