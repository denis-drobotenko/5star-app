import Joi from 'joi';
import logger from '../../server/config/logger.js';
import { Request, Response, NextFunction, RequestHandler } from 'express';

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

export const companyIdSchema: Joi.ObjectSchema = Joi.object({
  id: Joi.number().integer().required().messages(messages.id),
});

export const getAllCompaniesSchema: Joi.ObjectSchema = Joi.object({
  clientId: Joi.number().integer().optional().messages(messages.clientId),
});

const companyBaseSchemaDefinition = {
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

export const createCompanySchema: Joi.ObjectSchema = Joi.object({
  ...companyBaseSchemaDefinition,
  client_id: companyBaseSchemaDefinition.client_id.required(),
  name: companyBaseSchemaDefinition.name.required(),
  inn: companyBaseSchemaDefinition.inn.required(),
});

export const updateCompanySchema: Joi.ObjectSchema = Joi.object({
  ...companyBaseSchemaDefinition,
}).min(1);

export const validateBody = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Body validation failed: %o', errors);
    res.status(400).json({ message: 'Ошибка валидации данных запроса', errors });
    return;
  }
  next();
};

export const validateParams = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Params validation failed: %o', errors);
    res.status(400).json({ message: 'Ошибка валидации параметров пути', errors });
    return;
  }
  next();
};

export const validateQuery = (schema: Joi.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.query, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    logger.warn('[CompanyValidator] Query validation failed: %o', errors);
    res.status(400).json({ message: 'Ошибка валидации query-параметров', errors });
    return;
  }
  next();
}; 