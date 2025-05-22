import Joi from 'joi';
import logger from '../../server/config/logger.js';
import { Request, Response, NextFunction } from 'express';

const messages = {
  s3Key: {
    'string.empty': 'Ключ S3 не может быть пустым',
    'any.required': 'Ключ S3 (s3Key) обязателен',
  },
};

export const processS3XLSXSchema = Joi.object({
  s3Key: Joi.string().required().messages(messages.s3Key),
});

export const validateBody = (schema: Joi.Schema) => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[XLSXValidator] Body validation failed: %o', errors);
    } else {
      console.warn('[XLSXValidator] Body validation failed:', errors);
    }
    return res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
  }
  next();
};

export {}; 