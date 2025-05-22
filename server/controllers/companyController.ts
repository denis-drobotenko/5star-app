import { Request, Response, NextFunction } from 'express';
// import companyValidator from '../../shared/validators/companyValidator.js';
// const { validateBody, validateParams, validateQuery, companyIdSchema, getAllCompaniesSchema, createCompanySchema, updateCompanySchema } = companyValidator;
import companyService from '../services/companyService.js';
// import { Company, Client } from '../../shared/models/index.js'; // Удаляем неиспользуемый импорт
import logger from '../config/logger.js';

/**
 * Получить список всех компаний
 * @route GET /api/companies
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} [clientId] - ID клиента для фильтрации компаний (req.query.clientId)
 * @returns {Array<Company>} 200 - Список компаний
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { clientId } = req.query;
  logger.info('[CompanyController.getAll] Request to get all companies. Query params: %o. Requesting user: %o', 
    req.query, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const companies = await companyService.getAllCompanies(clientId as string | undefined);
    logger.debug('[CompanyController.getAll] Found %d companies. Sending response.', companies.length);
    res.json(companies);
  } catch (error: any) {
    logger.error('[CompanyController.getAll] Failed to get all companies. Error: %s', error.message, {
      error: error,
      requestQuery: req.query,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Получить компанию по ID
 * @route GET /api/companies/:id
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} id.path.required - ID компании
 * @returns {Company} 200 - Данные компании
 * @returns {Error} 404 - Компания не найдена
 * @returns {Error} 500 - Ошибка сервера
 */
async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  const companyId = req.params.id;
  logger.info('[CompanyController.getById] Request to get company by ID: %s. Requesting user: %o', 
    companyId, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const company = await companyService.getCompanyById(companyId);
    if (!company) {
      logger.warn('[CompanyController.getById] Company not found for ID: %s', companyId);
      res.status(404).json({ message: 'Компания не найдена' });
      return;
    }
    logger.debug('[CompanyController.getById] Company found for ID %s. Sending response: %o', companyId, company);
    res.json(company);
  } catch (error: any) {
    logger.error('[CompanyController.getById] Failed to get company by ID %s. Error: %s', companyId, error.message, {
      error: error,
      companyIdParam: companyId,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Создать новую компанию (юрлицо клиента)
 * @route POST /api/companies
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} client_id.body.required - ID родительского клиента
 * @param {string} name.body.required - Название юрлица
 * @param {string} inn.body.required - ИНН
 * @param {string} [kpp.body] - КПП
 * @param {string} [legal_address.body] - Юридический адрес
 * @param {string} [postal_address.body] - Почтовый адрес
 * @param {string} [actual_address.body] - Фактический адрес
 * @param {string} [bank_details.body] - Банковские реквизиты
 * @param {string} [edo_provider_name.body] - Название системы ЭДО
 * @returns {Company} 201 - Созданная компания
 * @returns {Error} 400 - Ошибка валидации или клиент не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  // req.body уже провалидирован мидлваром companyValidator.createCompanySchema
  const companyData = req.body; 
  logger.info('[CompanyController.create] Attempting to create company. Body: %o. Requesting user: %o', 
    companyData, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    // Передаем все тело запроса в сервис, так как оно уже содержит все необходимые поля
    const newCompany = await companyService.createCompany(companyData);

    logger.info('[CompanyController.create] Company created successfully. ID: %s, Name: %s', newCompany.id, newCompany.name);
    res.status(201).json(newCompany);
  } catch (error: any) {
    if (error.status === 400) { // Кастомная ошибка от сервиса (Клиент не найден)
        logger.warn('[CompanyController.create] Bad request for company creation: %s. Body: %o', error.message, companyData);
        res.status(400).json({ message: error.message });
        return;
    }
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      logger.warn('[CompanyController.create] Validation/Constraint error for company %s: %s. Errors: %o', companyData.name, error.message, error.errors ? error.errors.map((e: any) => e.message) : 'N/A');
      res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    }
    logger.error('[CompanyController.create] Failed to create company. Error: %s', error.message, {
      error: error,
      requestBody: companyData,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    next(error);
  }
}

/**
 * Обновить компанию (юрлицо клиента)
 * @route PUT /api/companies/:id
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} id.path.required - ID компании
 * @param {object} body.body - Данные для обновления (могут включать client_id, name, inn, kpp и т.д.)
 * @returns {Company} 200 - Обновлённая компания
 * @returns {Error} 400 - Ошибка валидации или клиент не найден (если client_id меняется)
 * @returns {Error} 404 - Компания не найдена
 * @returns {Error} 500 - Ошибка сервера
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const companyId = req.params.id;
  // req.body уже провалидирован мидлваром companyValidator.updateCompanySchema
  const updateData = req.body;

  logger.info('[CompanyController.update] Attempting to update company ID %s. Body: %o. Requesting user: %o',
    companyId,
    updateData,
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );
  try {
    const updatedCompany = await companyService.updateCompany(companyId, updateData);
    
    // Сервис вернет null или выбросит ошибку, если компания не найдена, 
    // но для единообразия можно оставить проверку и в контроллере, 
    // хотя сервис уже должен был выбросить ошибку со статусом 404.
    // В текущей реализации сервиса, он выбрасывает ошибку, так что updatedCompany не будет null.

    logger.info('[CompanyController.update] Company ID %s updated successfully.', companyId);
    res.json(updatedCompany);
  } catch (error: any) {
    if (error.status === 404) { // Ошибка "Компания не найдена" от сервиса
      logger.warn('[CompanyController.update] Company not found for ID: %s during update. Error: %s', companyId, error.message);
      res.status(404).json({ message: error.message });
      return;
    }
    if (error.status === 400) { // Ошибка "Клиент ... не найден" от сервиса
      logger.warn('[CompanyController.update] Bad request for company update ID %s: %s. Body: %o', companyId, error.message, updateData);
      res.status(400).json({ message: error.message });
      return;
    }
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      logger.warn('[CompanyController.update] Validation/Constraint error for company ID %s: %s. Errors: %o', companyId, error.message, error.errors ? error.errors.map((e: any) => e.message) : 'N/A');
      res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    }
    logger.error('[CompanyController.update] Failed to update company ID %s. Error: %s', companyId, error.message, {
      error: error,
      companyIdParam: companyId,
      requestBody: updateData,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    next(error);
  }
}

/**
 * Удалить компанию (юрлицо клиента)
 * @route DELETE /api/companies/:id
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} id.path.required - ID компании
 * @returns {object} 200 - Сообщение об удалении
 * @returns {Error} 404 - Компания не найдена
 * @returns {Error} 500 - Ошибка сервера
 */
async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  const companyId = req.params.id;
  logger.info('[CompanyController.remove] Attempting to delete company ID %s. Requesting user: %o', 
    companyId, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    await companyService.deleteCompany(companyId);
    logger.info('[CompanyController.remove] Company ID %s deleted successfully.', companyId);
    res.status(204).send(); // Стандартный ответ для успешного удаления

  } catch (error: any) {
    if (error.status === 404) { // Ошибка "Компания не найдена" от сервиса
      logger.warn('[CompanyController.remove] Company not found for ID: %s during delete attempt. Error: %s', companyId, error.message);
      res.status(404).json({ message: error.message });
      return;
    }
    // Обработка других ошибок, например, если компания связана с другими сущностями и не может быть удалена (если такая логика есть в сервисе)
    // if (error.name === 'SequelizeForeignKeyConstraintError') {
    //   logger.warn('[CompanyController.remove] Cannot delete company ID %s due to foreign key constraints. Error: %s', companyId, error.message);
    //   return res.status(400).json({ message: 'Невозможно удалить компанию, так как с ней связаны другие данные.' });
    // }
    logger.error('[CompanyController.remove] Failed to delete company ID %s. Error: %s', companyId, error.message, {
      error: error,
      companyIdParam: companyId,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    next(error);
  }
}

export {
  getAll,
  getById,
  create,
  update,
  remove
}; 