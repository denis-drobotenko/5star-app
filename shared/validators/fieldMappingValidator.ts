import Joi from 'joi';
import logger from '../../server/config/logger.js';

const messages = {
  id: {
    'number.base': 'ID должен быть числом',
    'number.integer': 'ID должен быть целым числом',
    'any.required': 'ID маппинга обязателен',
  },
  clientId: {
    'number.base': 'ID клиента должен быть числом',
    'number.integer': 'ID клиента должен быть целым числом',
    'any.required': 'ID клиента обязателен для этого действия',
  },
  companyId: {
    'number.base': 'ID компании должен быть числом',
    'number.integer': 'ID компании должен быть целым числом',
    'any.required': 'ID компании обязателен',
  },
  name: {
    'string.empty': 'Название маппинга не может быть пустым',
    'any.required': 'Название маппинга обязательно',
  },
  mappingObject: {
    'object.base': 'Маппинг должен быть объектом',
    'any.required': 'Объект маппинга обязателен',
  },
  key: {
    'string.empty': 'Ключ файла не может быть пустым',
    'any.required': 'Ключ файла обязателен',
  },
  mappingName: {
    'string.empty': 'Имя маппинга (для файла) не может быть пустым',
    'any.required': 'Имя маппинга (для файла) обязательно',
  },
};

const mappingIdSchema = Joi.object({
  id: Joi.number().integer().required().messages(messages.id),
});

const clientIdParamsSchema = Joi.object({
    clientId: Joi.number().integer().required().messages(messages.clientId),
});

const baseMappingSchema = {
  name: Joi.string().messages(messages.name),
  mapping: Joi.object().required().messages(messages.mappingObject),
  client_id: Joi.number().integer().optional().allow(null).messages(messages.clientId), // Optional, т.к. может браться из токена
  sample_data_url: Joi.string().uri({ allowRelative: true }).optional().allow(null, ''),
};

const createMappingSchema = Joi.object({
  ...baseMappingSchema,
  name: baseMappingSchema.name.required(),
  // client_id обрабатывается в контроллере (либо из body, либо из токена), но если указан, должен быть integer
});

const updateMappingSchema = Joi.object({
  ...baseMappingSchema,
  name: baseMappingSchema.name.optional(), // При обновлении имя может не меняться
  mapping: baseMappingSchema.mapping.optional(), // Как и сам маппинг
}).min(1); // Хотя бы одно поле для обновления

// Для POST /api/field-mappings/upload-sample (валидируем текстовые поля из formData)
const uploadSampleSchema = Joi.object({
  client_id: Joi.number().integer().required().messages(messages.clientId), 
  mappingName: Joi.string().required().messages(messages.mappingName),
  // Сам файл (req.file) обрабатывается multer и здесь не валидируется Joi
});

// Для GET /api/field-mappings/get-signed-url
const getSignedUrlSchema = Joi.object({
  key: Joi.string().required().messages(messages.key),
});

const validateBody = (schema: any) => (req: any, res: any, next: any) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail: any) => detail.message);
    logger.warn('[FieldMappingValidator] Body validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
  }
  next();
};

const validateParams = (schema: any) => (req: any, res: any, next: any) => {
  logger.debug(`[FieldMappingValidator.validateParams] Validating params for ${req.method} ${req.originalUrl} with schema. Keys: ${Object.keys(schema.describe().keys || {})}`);
  logger.debug(`[FieldMappingValidator.validateParams] req.params: ${JSON.stringify(req.params)}`);
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail: any) => detail.message);
    logger.warn('[FieldMappingValidator] Params validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации параметров пути', errors });
  }
  next();
};

const validateQuery = (schema: any) => (req: any, res: any, next: any) => {
  logger.debug(`[FieldMappingValidator.validateQuery] Validating query for ${req.method} ${req.originalUrl} with schema. Keys: ${Object.keys(schema.describe().keys || {})}`);
  logger.debug(`[FieldMappingValidator.validateQuery] req.query: ${JSON.stringify(req.query)}`);
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail: any) => detail.message);
    logger.warn('[FieldMappingValidator] Query validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации query-параметров', errors });
  }
  next();
};

export {
  validateBody,
  validateParams,
  validateQuery,
  mappingIdSchema,
  clientIdParamsSchema,
  createMappingSchema,
  updateMappingSchema,
  uploadSampleSchema,
  getSignedUrlSchema
}; 