import Joi from 'joi';
import { Request, Response, NextFunction, RequestHandler } from 'express';

const messages = {
  email: {
    'string.email': 'Некорректный формат email',
    'any.required': 'Email обязателен',
  },
  password: {
    'string.min': 'Пароль должен быть не менее 6 символов',
    'any.required': 'Пароль обязателен',
  },
  role: {
    'any.required': 'Роль обязательна',
  },
  user_type: {
    'any.required': 'Тип пользователя обязателен',
  },
  fullName: {
    'any.required': 'ФИО обязательно',
  },
  id: {
    'number.base': 'ID должен быть числом',
    'number.integer': 'ID должен быть целым числом',
    'any.required': 'ID обязателен',
  },
  clientId: {
    'number.base': 'ID клиента должен быть числом',
    'number.integer': 'ID клиента должен быть целым числом',
  },
};

export const createUserSchema = Joi.object({
  email: Joi.string().email().required().messages(messages.email),
  password: Joi.string().min(6).required().messages(messages.password),
  full_name: Joi.string().optional().allow(null, ''),
  role: Joi.string().required().messages(messages.role),
  user_type: Joi.string().required().messages(messages.user_type),
  phone: Joi.string().optional().allow(null, ''),
  position: Joi.string().optional().allow(null, ''),
  client_id: Joi.number().integer().optional().allow(null).messages(messages.clientId),
  username: Joi.string().optional().allow(null, ''),
});

export const updateUserSchema = Joi.object({
  email: Joi.string().email().optional().messages(messages.email),
  password: Joi.string().min(6).optional().messages(messages.password),
  full_name: Joi.string().optional().allow(null, ''),
  role: Joi.string().optional(),
  user_type: Joi.string().optional(),
  phone: Joi.string().optional().allow(null, ''),
  position: Joi.string().optional().allow(null, ''),
  client_id: Joi.number().integer().optional().allow(null).messages(messages.clientId),
  is_active: Joi.boolean().optional(),
  username: Joi.string().optional().allow(null, ''),
}).min(1);

export const userIdSchema = Joi.object({
  id: Joi.number().integer().required().messages(messages.id),
});

export const getAllUsersSchema = Joi.object({
  clientId: Joi.number().integer().optional().messages(messages.clientId),
  userType: Joi.string().optional(),
});

export const validateBody = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    res.status(400).json({ message: 'Ошибка валидации тела запроса', errors });
    return;
  }
  next();
};

export const validateParams = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    res.status(400).json({ message: 'Ошибка валидации параметров пути', errors });
    return;
  }
  next();
};

export const validateQuery = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    res.status(400).json({ message: 'Ошибка валидации query-параметров', errors });
    return;
  }
  next();
}; 