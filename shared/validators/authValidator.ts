import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Некорректный формат email',
    'any.required': 'Email обязателен',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль должен быть не менее 6 символов',
    'any.required': 'Пароль обязателен',
  }),
  fullName: Joi.string().required().messages({
    'any.required': 'ФИО обязательно',
  }),
  role: Joi.string().required().messages({
    'any.required': 'Роль обязательна',
  }),
  user_type: Joi.string().required().messages({
    'any.required': 'Тип пользователя обязателен',
  }),
  client_id: Joi.number().integer().optional(),
  company_id: Joi.number().integer().optional(),
  position: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Некорректный формат email',
    'any.required': 'Email обязателен',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Пароль обязателен',
  }),
});

const requestPasswordResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Некорректный формат email',
    'any.required': 'Email обязателен',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Токен обязателен',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль должен быть не менее 6 символов',
    'any.required': 'Пароль обязателен',
  }),
});

// Middleware для валидации
const validate = (schema: Joi.Schema) => (req: Request, res: Response, next: NextFunction): void => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail: Joi.ValidationErrorItem) => detail.message);
    res.status(400).json({ message: 'Ошибка валидации', errors });
    return;
  }
  next();
};

export { validate, registerSchema, loginSchema, requestPasswordResetSchema, resetPasswordSchema }; 