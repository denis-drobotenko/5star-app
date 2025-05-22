const FieldMapping = require('../models/fieldMapping')
const Client = require('../models/client')
const { s3Client, S3_BUCKET_NAME } = require('../config/s3')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const logger = require('../config/logger')
const { v4: uuidv4 } = require('uuid')
const FieldMappingService = require('../services/fieldMappingService');
const {
  validateBody,
  validateParams,
  validateQuery,
  mappingIdSchema,
  companyIdParamsSchema,
  clientIdParamsSchema,
  createMappingSchema,
  updateMappingSchema,
  uploadSampleSchema,
  getSignedUrlSchema,
} = require('../middlewares/validators/fieldMappingValidator');

class FieldMappingController {
  /**
   * @route GET /api/field-mappings
   * @group FieldMappings - Operations about field mappings
   * @summary Get all field mappings, optionally filtered by user's client_id.
   * @param {object} req.user - Optional. The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user. If present, filters mappings by this client_id.
   * @returns {Array<FieldMapping>} 200 - An array of field mapping objects.
   * @returns {Error}  default - Unexpected error
   */
  static async getAll(req, res, next) {
    logger.info('[FieldMappingController.getAll] Request to get all mappings. User: %o, Query: %o', 
      req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' },
      req.query
    );
    try {
      let filterClientId = null;

      // 1. Приоритет у req.query.clientId, если он есть
      if (req.query.clientId) {
        const queryClientId = parseInt(req.query.clientId, 10);
        if (!isNaN(queryClientId)) {
          filterClientId = queryClientId;
          logger.debug(`[FieldMappingController.getAll] Using clientId from query parameter: ${filterClientId}`);
          
          // Дополнительная проверка для не-админов: могут ли они запрашивать этот clientId?
          // Если у пользователя есть свой client_id, и он запрашивает другой client_id, это может быть запрещено
          // (зависит от бизнес-логики, текущая реализация getMappingsByClientId уже содержит такую проверку, но здесь мы можем ее усилить или оставить как есть)
          // Пока что, если админ (user.client_id == null), он может запрашивать любой client_id.
          // Если пользователь привязан к клиенту (user.client_id != null) и запрашивает маппинги другого клиента (queryClientId !== req.user.client_id) - это ошибка.
          if (req.user && req.user.client_id != null && filterClientId !== req.user.client_id) {
            logger.warn(`[FieldMappingController.getAll] Forbidden: User ${req.user.id} (client_id ${req.user.client_id}) attempting to access mappings for client_id ${filterClientId} via query param.`);
            return res.status(403).json({ message: 'Нет доступа к маппингам другого клиента' });
          }
        } else {
          logger.warn(`[FieldMappingController.getAll] Invalid clientId in query parameter: ${req.query.clientId}. Ignoring.`);
        }
      } else if (req.user && req.user.client_id != null) {
        // 2. Если req.query.clientId нет, но у пользователя есть client_id, используем его
        filterClientId = req.user.client_id;
        logger.debug(`[FieldMappingController.getAll] No clientId in query. Using client_id ${filterClientId} from user token.`);
      } else {
        // 3. Если нет ни query.clientId, ни user.client_id (например, админ без query), тогда filterClientId остается null (показать все)
        logger.debug('[FieldMappingController.getAll] No clientId in query or user token. Admin or system request for all mappings.');
      }
      
      // Передаем определенный filterClientId в сервис
      const mappings = await FieldMappingService.getAllMappings(filterClientId);

      // Убираем излишне подробное логирование всего списка маппингов, если он большой
      logger.info('[FieldMappingController.getAll] Found %d mappings. Sending response.', mappings.length);
      // Если нужно логировать детали, можно сделать это на уровне debug или если count маленький
      if (mappings.length < 10 && mappings.length > 0) { // Пример условия для детального логирования
          logger.debug('[FieldMappingController.getAll] Mappings data (sample): %o', mappings.map(m => ({ 
              id: m.id, name: m.name, client_id: m.client_id, client_name: m.client ? m.client.name : null
        }))
          );
      }
      res.json(mappings);
    } catch (error) {
      logger.error('[FieldMappingController.getAll] Failed to get mappings. Error: %s', error.message, {
        error: error,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route GET /api/field-mappings/client/{clientId}
   * @group FieldMappings - Operations about field mappings
   * @summary Get all field mappings for a specific client.
   * @param {number} clientId.path.required - The ID of the client.
   * @param {object} req.user - The authenticated user object.
   * @param {string} req.user.role - The role of the user.
   * @param {number} [req.user.client_id] - The client_id associated with the user.
   * @returns {Array<FieldMapping>} 200 - An array of field mapping objects for the client.
   * @returns {object} 403 - Forbidden if user tries to access mappings of another client.
   * @returns {Error}  default - Unexpected error
   */
  static async getByClientId(req, res, next) {
    const clientId = parseInt(req.params.clientId, 10);
    logger.info('[FieldMappingController.getByClientId] Request to get mappings by client ID: %s. Requesting user: %o',
      clientId,
      req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
    );
    try {
      if (req.user && req.user.client_id != null && req.user.client_id !== clientId) {
        logger.warn('[FieldMappingController.getByClientId] Forbidden access for user ID %s (client_id %s) to client ID %s mappings.', 
          req.user.id, req.user.client_id, clientId);
        return res.status(403).json({ message: 'Нет доступа к маппингам другого клиента' });
      }

      const mappings = await FieldMappingService.getMappingsByClientId(clientId);
      logger.info('[FieldMappingController.getByClientId] Found %d mappings for client ID %s.', mappings.length, clientId);
      res.json(mappings);
    } catch (error) {
      logger.error('[FieldMappingController.getByClientId] Failed to get mappings for client ID %s. Error: %s', clientId, error.message, {
        error: error,
        clientIdParam: clientId,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route GET /api/field-mappings/{id}
   * @group FieldMappings - Operations about field mappings
   * @summary Get a specific field mapping by its ID.
   * @param {number} id.path.required - The ID of the field mapping.
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user. Used for access control.
   * @returns {FieldMapping} 200 - The field mapping object.
   * @returns {object} 403 - Forbidden if user (with client_id) tries to access mapping of another client.
   * @returns {object} 404 - Mapping not found.
   * @returns {Error}  default - Unexpected error
   */
  static async getById(req, res, next) {
    const mappingId = req.params.id;
    logger.info('[FieldMappingController.getById] Request to get mapping by ID: %s. Requesting user: %o',
      mappingId,
      req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
    );
    try {
      const mapping = await FieldMappingService.getMappingById(mappingId);
      
      if (!mapping) {
        logger.warn('[FieldMappingController.getById] Mapping not found for ID: %s', mappingId);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      // Логгирование деталей маппинга уже было, можно его оставить или сделать более кратким
      logger.debug('[FieldMappingController.getById] Mapping found for ID %s: %o', mappingId, {
        id: mapping.id, name: mapping.name, client_id: mapping.client_id, client_name: mapping.client ? mapping.client.name : null
      });

      // Проверяем права доступа (исходя из того, что системный пользователь client_id=null, а обычный имеет client_id)
      // Эта логика должна быть согласована с getAll. Если req.user.client_id есть, то mapping.client_id должен совпадать.
      // Если у пользователя нет req.user.client_id (например, админ или системный пользователь), он может видеть любой маппинг.
      if (req.user && req.user.client_id != null && mapping.client_id !== req.user.client_id) {
        logger.warn('[FieldMappingController.getById] Forbidden access for user ID %s (client_id %s) to mapping ID %s (client_id %s).',
          req.user.id, req.user.client_id, mappingId, mapping.client_id);
        return res.status(403).json({ message: 'Нет доступа к этому маппингу' });
      }

      res.json(mapping);
    } catch (error) {
      logger.error('[FieldMappingController.getById] Failed to get mapping by ID %s. Error: %s', mappingId, error.message, {
        error: error,
        mappingIdParam: mappingId,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route POST /api/field-mappings
   * @group FieldMappings - Operations about field mappings
   * @summary Create a new field mapping.
   * @param {object} req.body.required - Field mapping data.
   * @param {string} req.body.name.required - Name of the mapping.
   * @param {object} req.body.mapping.required - The mapping object itself (source_field -> target_field_details).
   * @param {number} [req.body.client_id] - Optional. ID of the client. If not provided and user has client_id, user's client_id is used.
   * @param {string} [req.body.sample_data_url] - Optional. URL to a sample data file (e.g., S3 key).
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user.
   * @returns {FieldMapping} 201 - The created field mapping object.
   * @returns {object} 400 - Validation error or Client not found if client_id is provided but invalid.
   * @returns {object} 403 - Forbidden if user with client_id attempts to create mapping for another client_id.
   * @returns {Error}  default - Unexpected error
   */
  static async create(req, res, next) {
      const { name, mapping, client_id, sample_data_url } = req.body;
    const mappingDataForLog = { name, client_id, sample_data_url, mapping_keys: mapping ? Object.keys(mapping) : null };
      
    logger.info('[FieldMappingController.create] Attempting to create mapping. Data: %o. Requesting user: %o',
      mappingDataForLog,
      req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
    );

    let final_client_id = client_id;
    if (final_client_id == null && req.user && req.user.client_id != null) {
      final_client_id = req.user.client_id;
      logger.debug('[FieldMappingController.create] client_id not in body, using client_id %s from user token.', final_client_id);
    }

    // Проверка прав: если у пользователя есть client_id, он может создавать маппинг только для этого client_id.
    // Админ (без client_id в токене) может создавать для любого, указанного в final_client_id.
    if (req.user && req.user.client_id != null && final_client_id !== req.user.client_id) {
      logger.warn('[FieldMappingController.create] Forbidden: User %s (client_id %s) attempting to create mapping for client_id %s.',
        req.user.id, req.user.client_id, final_client_id);
      return res.status(403).json({ message: 'Вы не можете создавать маппинги для другого клиента' });
    }
    
    try {
      const newMapping = await FieldMappingService.createMapping({
        name,
        mapping,
        client_id: final_client_id,
        sample_data_url
      });
      
      res.status(201).json(newMapping);

    } catch (error) {
      if (error.statusCode === 400) { // Ошибка от сервиса (клиент не найден)
        logger.warn(`[FieldMappingController.create] Error from service: ${error.message}`);
        return res.status(400).json({ message: error.message });
      }
      if (error.name === 'SequelizeValidationError') {
        logger.warn('[FieldMappingController.create] Sequelize validation error: %s. Errors: %o', error.message, error.errors.map(e => e.message));
        return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
      }
      logger.error('[FieldMappingController.create] Failed to create mapping. Error: %s', error.message, {
        error: error,
        requestBody: mappingDataForLog, // Логируем подготовленные данные
        finalClientIdUsed: final_client_id,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route PUT /api/field-mappings/{id}
   * @group FieldMappings - Operations about field mappings
   * @summary Update an existing field mapping.
   * @param {number} id.path.required - The ID of the field mapping to update.
   * @param {object} req.body.required - Field mapping data to update.
   * @param {string} [req.body.name] - New name of the mapping.
   * @param {object} [req.body.mapping] - New mapping object.
   * @param {number} [req.body.client_id] - New client ID for the mapping. If user has client_id, this must match or be absent.
   * @param {string} [req.body.sample_data_url] - Optional. New URL to a sample data file (e.g., S3 key). Can be null to remove.
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user.
   * @returns {FieldMapping} 200 - The updated field mapping object.
   * @returns {object} 400 - Validation error or Client not found if client_id is provided and invalid.
   * @returns {object} 403 - Forbidden if user tries to update mapping of another client or change client_id inappropriately.
   * @returns {object} 404 - Mapping not found.
   * @returns {Error}  default - Unexpected error
   */
  static async update(req, res, next) {
    const mappingId = req.params.id;
    const { name, mapping, client_id, sample_data_url } = req.body;
    const updateDataForLog = { name, client_id, sample_data_url, mapping_keys: mapping ? Object.keys(mapping) : null };

    logger.info('[FieldMappingController.update] Attempting to update mapping ID %s. Data: %o. Requesting user: %o',
      mappingId, updateDataForLog,
      req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
    );

    try {
      // Передаем client_id пользователя в сервис для проверки авторизации на уровне сервиса
      const userClientId = (req.user && req.user.client_id != null) ? req.user.client_id : null;
      
      // Дополнительная проверка в контроллере: пользователь с client_id не может менять client_id маппинга на другой
      if (userClientId !== null && client_id != null && userClientId !== client_id) {
         logger.warn('[FieldMappingController.update] Forbidden: User %s (client_id %s) attempting to change mapping client_id to %s for mapping ID %s.',
            req.user.id, userClientId, client_id, mappingId);
         return res.status(403).json({ message: 'Вы не можете изменить ID клиента для этого маппинга.' });
      }

      const updatedMapping = await FieldMappingService.updateMapping(
        mappingId, 
        { name, mapping, client_id, sample_data_url }, 
        userClientId // client_id текущего пользователя для авторизации в сервисе
      );

      if (!updatedMapping) {
        logger.warn('[FieldMappingController.update] Mapping with ID %s not found after update attempt.', mappingId);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      
      res.json(updatedMapping);
    } catch (error) {
      if (error.statusCode === 404) { // Уже не должно происходить, т.к. сервис вернет null
        logger.warn(`[FieldMappingController.update] Mapping not found (service returned null), ID: ${mappingId}`);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      if (error.statusCode === 403) {
        logger.warn(`[FieldMappingController.update] Forbidden (service error): ${error.message}`);
        return res.status(403).json({ message: error.message });
      }
      if (error.statusCode === 400) { // Ошибка от сервиса (например, клиент не найден при смене client_id)
        logger.warn(`[FieldMappingController.update] Bad request (service error): ${error.message}`);
        return res.status(400).json({ message: error.message });
      }
      if (error.name === 'SequelizeValidationError') {
        logger.warn('[FieldMappingController.update] Sequelize validation error: %s. Errors: %o', error.message, error.errors.map(e => e.message));
        return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
      }
      logger.error('[FieldMappingController.update] Failed to update mapping ID %s. Error: %s', mappingId, error.message, {
        error: error,
        requestBody: updateDataForLog,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route DELETE /api/field-mappings/{id}
   * @group FieldMappings - Operations about field mappings
   * @summary Delete a field mapping by its ID.
   * @param {number} id.path.required - The ID of the field mapping to delete.
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user.
   * @returns {object} 204 - No content (successful deletion).
   * @returns {object} 403 - Forbidden if user tries to delete mapping of another client.
   * @returns {object} 404 - Mapping not found.
   * @returns {Error}  default - Unexpected error
   */
  static async delete(req, res, next) {
    const mappingId = req.params.id;
    logger.info('[FieldMappingController.delete] Request to delete mapping ID %s. Requesting user: %o',
      mappingId,
      req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
    );
    try {
      const userClientId = (req.user && req.user.client_id != null) ? req.user.client_id : null;
      const deleted = await FieldMappingService.deleteMapping(mappingId, userClientId);

      if (!deleted) {
        logger.warn('[FieldMappingController.delete] Mapping ID %s not found for deletion (service returned false).', mappingId);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      
      logger.info('[FieldMappingController.delete] Mapping ID %s deleted successfully. Sending 204 response.', mappingId);
      res.status(204).send();
    } catch (error) {
      if (error.statusCode === 403) {
        logger.warn(`[FieldMappingController.delete] Forbidden (service error): ${error.message} for mapping ID ${mappingId}`);
        return res.status(403).json({ message: error.message });
      }
       // Не должно быть 404 отсюда, так как сервис вернет false, что обработано выше
      logger.error('[FieldMappingController.delete] Failed to delete mapping ID %s. Error: %s', mappingId, error.message, {
        error: error,
        mappingIdParam: mappingId,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route POST /api/field-mappings/{id}/upload-sample
   * @group FieldMappings - Operations about field mappings
   * @summary Upload a sample data file (Excel/CSV) for a field mapping.
   * @param {number} id.path.required - The ID of the field mapping.
   * @param {file} req.file.required - The sample file to upload.
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user.
   * @returns {FieldMapping} 200 - The updated field mapping object with the new sample_data_url.
   * @returns {object} 400 - No file provided or other validation error.
   * @returns {object} 403 - Forbidden if user tries to upload for mapping of another client.
   * @returns {object} 404 - Mapping not found.
   * @returns {Error}  default - Unexpected error
   */
  static async uploadSample(req, res, next) {
    const mappingId = req.params.id;
    const file = req.file;

    logger.info('[FieldMappingController.uploadSample] Request to upload sample for mapping ID %s. File: %s. User: %o',
        mappingId, file ? file.originalname : 'No file provided',
        req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
    );

    if (!file) {
      logger.warn('[FieldMappingController.uploadSample] No file provided for mapping ID %s.', mappingId);
      return res.status(400).json({ message: 'Файл не предоставлен' });
    }

    try {
      const userClientId = (req.user && req.user.client_id != null) ? req.user.client_id : null;
      const updatedMapping = await FieldMappingService.uploadSampleFile(mappingId, file, userClientId);

      if (!updatedMapping) {
        logger.warn('[FieldMappingController.uploadSample] Mapping ID %s not found (service returned null).', mappingId);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      
      res.json(updatedMapping);
    } catch (error) {
      if (error.statusCode === 404) { // Уже не должно происходить от сервиса
        logger.warn(`[FieldMappingController.uploadSample] Mapping not found for ID: ${mappingId}. Error: ${error.message}`);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      if (error.statusCode === 403) {
        logger.warn(`[FieldMappingController.uploadSample] Forbidden for mapping ID: ${mappingId}. Error: ${error.message}`);
        return res.status(403).json({ message: error.message });
      }
      if (error.statusCode === 400) {
        logger.warn(`[FieldMappingController.uploadSample] Bad request for mapping ID: ${mappingId}. Error: ${error.message}`);
        return res.status(400).json({ message: error.message });
      }
      logger.error('[FieldMappingController.uploadSample] Failed to upload sample for mapping ID %s. Error: %s', mappingId, error.message, {
          error: error,
          mappingIdParam: mappingId,
          fileName: file.originalname,
          requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
      });
      next(error);
    }
  }

  /**
   * @route GET /api/field-mappings/{id}/signed-url
   * @group FieldMappings - Operations about field mappings
   * @summary Get a signed URL for the sample data file of a field mapping.
   * @param {number} id.path.required - The ID of the field mapping.
   * @param {number} [expiresIn] - Optional. URL expiration time in seconds (default 3600).
   * @param {object} req.user - The authenticated user object.
   * @param {number} [req.user.client_id] - Optional. client_id of the user.
   * @returns {object} 200 - Object containing the signed URL: { signedUrl: "..." }.
   * @returns {object} 403 - Forbidden if user tries to access sample of another client's mapping.
   * @returns {object} 404 - Mapping or sample data URL not found.
   * @returns {Error}  default - Unexpected error (e.g. S3 error).
   */
  static async getSignedUrl(req, res, next) {
    const mappingId = req.params.id;
    const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn, 10) : 3600;
    const userForLog = req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' };

    logger.info('[FieldMappingController.getSignedUrl] Request for signed URL. Mapping ID: %s, ExpiresIn: %s, User: %o',
      mappingId, expiresIn, userForLog);

    try {
      const userClientId = (req.user && req.user.client_id != null) ? req.user.client_id : null;
      const signedUrl = await FieldMappingService.getSampleFileSignedUrl({
        mappingId: mappingId,
        requesting_client_id: userClientId,
        expiresIn: expiresIn
      });

      if (!signedUrl) {
        // Это может означать, что маппинг не найден, или у маппинга нет sample_data_url
        logger.warn('[FieldMappingController.getSignedUrl] Could not get signed URL for mapping ID %s (service returned null). It might be not found or has no sample data.', mappingId);
        // Мы уже проверили, что маппинг существует и имеет URL в сервисе, так что это скорее 404 для sample_data_url
        const mapping = await FieldMappingService.getMappingById(mappingId); // Проверим, существует ли маппинг
        if (!mapping) {
             return res.status(404).json({ message: 'Маппинг не найден' });
        }
        // Если маппинг есть, но URL нет, это тоже 404 для ресурса (файла)
        return res.status(404).json({ message: 'Образец данных для этого маппинга не найден или еще не загружен.' });
      }
      
      res.json({ signedUrl });
    } catch (error) {
      if (error.statusCode === 404) { // От сервиса, если маппинг не найден изначально
        logger.warn(`[FieldMappingController.getSignedUrl] Mapping not found for ID: ${mappingId}. Error: ${error.message}`);
        return res.status(404).json({ message: 'Маппинг не найден' });
      }
      if (error.statusCode === 403) {
        logger.warn(`[FieldMappingController.getSignedUrl] Forbidden for mapping ID: ${mappingId}. Error: ${error.message}`);
        return res.status(403).json({ message: error.message });
      }
      logger.error('[FieldMappingController.getSignedUrl] Failed to get signed URL for mapping ID %s. Error: %s', mappingId, error.message, {
        error: error,
        mappingIdParam: mappingId,
        requestingUser: userForLog
      });
      next(error);
    }
  }

  /**
   * @route GET /api/field-mappings/s3-signed-url
   * @group FieldMappings - Operations about field mappings
   * @summary Get a signed URL for a given S3 key.
   * @param {string} key.query.required - The S3 key for which to get the signed URL.
   * @param {number} [expiresIn.query] - Optional. URL expiration time in seconds (default 3600).
   * @param {object} req.user - The authenticated user object.
   * @returns {object} 200 - Object containing the signed URL: { signedUrl: "..." }.
   * @returns {object} 400 - If key is not provided.
   * @returns {object} 404 - If S3 key not found.
   * @returns {Error}  default - Unexpected error (e.g. S3 error).
   */
  static async getS3FileSignedUrl(req, res, next) {
    const { key, expiresIn: expiresInQuery } = req.query;
    const expiresIn = expiresInQuery ? parseInt(expiresInQuery, 10) : 3600;
    const userForLog = req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' };

    logger.info('[FieldMappingController.getS3FileSignedUrl] Request for S3 signed URL. Key: %s, ExpiresIn: %s, User: %o',
      key, expiresIn, userForLog);

    if (!key) {
      logger.warn('[FieldMappingController.getS3FileSignedUrl] S3 key not provided in query.');
      return res.status(400).json({ message: 'Параметр "key" (ключ S3) обязателен.' });
    }

    try {
      const signedUrl = await FieldMappingService.getSampleFileSignedUrl({ 
        s3Key: key, 
        expiresIn 
      });

      if (!signedUrl) {
        logger.warn('[FieldMappingController.getS3FileSignedUrl] Could not get signed URL for S3 key %s (service returned null). Key might not exist.', key);
        return res.status(404).json({ message: 'Файл по указанному ключу S3 не найден или доступ запрещен.' });
      }
      
      res.json({ signedUrl });
    } catch (error) {
      logger.error('[FieldMappingController.getS3FileSignedUrl] Failed to get S3 signed URL for key %s. Error: %s', key, error.message, {
        error: error,
        s3KeyQuery: key,
        requestingUser: userForLog
      });
      next(error);
    }
  }
}

module.exports = FieldMappingController 