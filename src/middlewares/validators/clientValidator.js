const Joi = require('joi');
const logger = require('../../config/logger');

const messages = {
  id: {
    'number.base': 'ID должен быть числом',
    'number.integer': 'ID должен быть целым числом',
    'any.required': 'ID клиента обязателен',
  },
  name: {
    'string.empty': 'Название клиента не может быть пустым',
    'any.required': 'Название клиента обязательно',
  },
  removeLogo: {
    'string.base': 'Флаг removeLogo должен быть строкой',
    'boolean.base': "Флаг removeLogo должен быть булевым значением или строкой 'true'/'false'",
  }
};

// Для GET /api/clients/:id и DELETE /api/clients/:id
const clientIdSchema = Joi.object({
  id: Joi.number().integer().required().messages(messages.id),
});

// Для POST /api/clients
// Валидируем только текстовые поля из formData, файл logoFile обрабатывается multer
const createClientSchema = Joi.object({
  name: Joi.string().required().messages(messages.name),
  // logoFile не валидируется Joi здесь, его наличие/обработку контролирует multer и логика контроллера
});

// Для PUT /api/clients/:id
// Валидируем только текстовые поля из formData
const updateClientSchema = Joi.object({
  name: Joi.string().optional().empty(''), // Позволяем пустое имя, если оно не меняется, или если его хотят очистить (если это возможно по бизнес-логике)
  removeLogo: Joi.alternatives().try(
    Joi.boolean(),
    Joi.string().valid('true', 'false')
  ).optional().messages(messages.removeLogo),
  // logoFile также не валидируется Joi
}).min(1); // Хотя бы одно поле должно быть для обновления (name или removeLogo)

// Middleware для валидации тела запроса (для formData, multer должен уже обработать файл и поместить текстовые поля в req.body)
const validateBody = (schema) => (req, res, next) => {
  // req.body будет содержать текстовые поля из multipart/form-data после обработки multer
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[ClientValidator] Body validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
  }
  next();
};

// Middleware для валидации параметров пути
const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[ClientValidator] Params validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации параметров пути', errors });
  }
  next();
};

// Для полноты, хотя в clientController он не используется напрямую для GET all.
// const validateQuery = (schema) => (req, res, next) => {
//   const { error } = schema.validate(req.query, { abortEarly: false });
//   if (error) {
//     const errors = error.details.map((detail) => detail.message);
//     return res.status(400).json({ message: 'Ошибка валидации query-параметров', errors });
//   }
//   next();
// };

module.exports = {
  validateBody,
  validateParams,
  // validateQuery, // Раскомментировать, если понадобится
  clientIdSchema,
  createClientSchema,
  updateClientSchema,
}; 