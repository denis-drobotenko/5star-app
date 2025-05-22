const Joi = require('joi');
const logger = require('../../config/logger');

const messages = {
  s3Key: {
    'string.empty': 'Ключ S3 не может быть пустым',
    'any.required': 'Ключ S3 (s3Key) обязателен',
  },
};

const processS3XLSXSchema = Joi.object({
  s3Key: Joi.string().required().messages(messages.s3Key),
});

const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[XLSXValidator] Body validation failed: %o', errors);
    return res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
  }
  next();
};

module.exports = {
  validateBody,
  processS3XLSXSchema,
}; 