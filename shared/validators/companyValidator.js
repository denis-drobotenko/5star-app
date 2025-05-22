const Joi = require('joi');
const logger = require('../../server/config/logger');

const messages = {
  id: {
    'number.base': 'ID должен быть числом',
    'number.integer': 'ID должен быть целым числом',
    'any.required': 'ID компании обязателен',
  },
  clientId: {
    'number.base': 'ID клиента должен быть числом',
    'number.integer': 'ID клиента должен быть целым числом',
    'any.required': 'ID клиента обязателен',
  },
  name: {
    'string.empty': 'Название компании не может быть пустым',
    'any.required': 'Название компании обязательно',
  },
  inn: {
    'string.empty': 'ИНН не может быть пустым',
    'any.required': 'ИНН обязателен',
    'string.pattern.base': 'ИНН должен состоять из 10 или 12 цифр',
  },
  kpp: {
    'string.pattern.base': 'КПП должен состоять из 9 цифр',
  }
};

// Для GET /api/companies/:id и DELETE /api/companies/:id
const companyIdSchema = Joi.object({
  id: Joi.number().integer().required().messages(messages.id),
});

// Для GET /api/companies
const getAllCompaniesSchema = Joi.object({
  clientId: Joi.number().integer().optional().messages(messages.clientId),
});

const companyBaseSchema = {
  client_id: Joi.number().integer().messages(messages.clientId),
  name: Joi.string().messages(messages.name),
  inn: Joi.string().pattern(/^(\d{10}|\d{12})$/).messages(messages.inn),
  kpp: Joi.string().pattern(/^\d{9}$/).optional().allow(null, '').messages(messages.kpp),
  legal_address: Joi.string().optional().allow(null, ''),
  postal_address: Joi.string().optional().allow(null, ''),
  actual_address: Joi.string().optional().allow(null, ''),
  bank_details: Joi.string().optional().allow(null, ''),
  edo_provider_name: Joi.string().optional().allow(null, ''),
};

// Для POST /api/companies
const createCompanySchema = Joi.object({
  ...companyBaseSchema,
  client_id: companyBaseSchema.client_id.required(),
  name: companyBaseSchema.name.required(),
  inn: companyBaseSchema.inn.required(),
});

// Для PUT /api/companies/:id
const updateCompanySchema = Joi.object({
  ...companyBaseSchema,
}).min(1); // Хотя бы одно поле для обновления


const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Body validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
  }
  next();
};

const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Params validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации параметров пути', errors });
  }
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Query validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации query-параметров', errors });
  }
  next();
};

module.exports = {
  validateBody,
  validateParams,
  validateQuery,
  companyIdSchema,
  getAllCompaniesSchema,
  createCompanySchema,
  updateCompanySchema,
}; 