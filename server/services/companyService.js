const { Company, Client, sequelize } = require('../../shared/models'); // Добавим sequelize для транзакций, если понадобится
const logger = require('../config/logger');

async function getAllCompanies(clientId) {
  logger.debug('[CompanyService.getAllCompanies] Fetching all companies. Filter clientId: %s', clientId);
  try {
    const whereClause = {};
    if (clientId) {
      whereClause.client_id = clientId;
    }
    const companies = await Company.findAll({
      where: whereClause,
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    logger.info(`[CompanyService.getAllCompanies] Successfully fetched ${companies.length} companies.`);
    return companies;
  } catch (error) {
    logger.error('[CompanyService.getAllCompanies] Error fetching companies: %s', error.message, { error, clientId });
    throw error;
  }
}

async function getCompanyById(companyId) {
  logger.debug('[CompanyService.getCompanyById] Fetching company by ID: %s', companyId);
  try {
    const company = await Company.findByPk(companyId, {
      include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }]
    });
    if (!company) {
      logger.warn('[CompanyService.getCompanyById] Company not found for ID: %s', companyId);
      return null; // Контроллер обработает и вернет 404
    }
    logger.info('[CompanyService.getCompanyById] Successfully fetched company ID: %s', companyId);
    return company;
  } catch (error) {
    logger.error('[CompanyService.getCompanyById] Error fetching company ID %s: %s', companyId, error.message, { error });
    throw error;
  }
}

async function createCompany(companyData) {
  const { client_id, name, inn, ...otherCompanyData } = companyData;
  logger.debug('[CompanyService.createCompany] Attempting to create company. Name: %s, INN: %s, ClientID: %s', name, inn, client_id);
  let newCompany;

  try {
    await sequelize.transaction(async (t) => {
      const client = await Client.findByPk(client_id, { transaction: t });
      if (!client) {
        logger.warn('[CompanyService.createCompany] Client not found for ID: %s', client_id);
        const error = new Error(`Клиент с ID ${client_id} не найден`);
        error.status = 400;
        throw error;
      }

      const companyToCreate = { client_id, name, inn, ...otherCompanyData };
      if (companyToCreate.hasOwnProperty('contact_persons')) {
          delete companyToCreate.contact_persons; 
      }

      logger.debug('[CompanyService.createCompany] Creating company in DB with data: %o', companyToCreate);
      const company = await Company.create(companyToCreate, { transaction: t });
      
      // Получаем компанию с присоединенным клиентом для возврата
      // Это нужно делать внутри транзакции, чтобы гарантировать согласованность данных
      newCompany = await Company.findByPk(company.id, {
          include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
          transaction: t
      });

      logger.info('[CompanyService.createCompany] Company created successfully. ID: %s, Name: %s', newCompany.id, newCompany.name);
    });
    return newCompany;
  } catch (error) {
    logger.error('[CompanyService.createCompany] Failed to create company. Name: %s, INN: %s. Error: %s', name, inn, error.message, { error, companyData });
    throw error;
  }
}

async function updateCompany(companyId, updateData) {
  logger.debug('[CompanyService.updateCompany] Attempting to update company ID %s with data: %o', companyId, updateData);
  let updatedCompany;
  try {
    await sequelize.transaction(async (t) => {
      const company = await Company.findByPk(companyId, { transaction: t });
      if (!company) {
        logger.warn('[CompanyService.updateCompany] Company not found for ID: %s', companyId);
        const error = new Error('Компания не найдена');
        error.status = 404;
        throw error;
      }

      const { client_id, ...dataToUpdate } = updateData;

      if (client_id && client_id !== company.client_id) {
        const client = await Client.findByPk(client_id, { transaction: t });
        if (!client) {
          logger.warn('[CompanyService.updateCompany] Client with ID %s for company linkage not found. Company ID: %s', client_id, companyId);
          const error = new Error(`Клиент с ID ${client_id} для смены привязки не найден`);
          error.status = 400;
          throw error;
        }
      }
      
      if (dataToUpdate.hasOwnProperty('contact_persons')) {
          delete dataToUpdate.contact_persons;
      }
      logger.debug('[CompanyService.updateCompany] Updating company ID %s in DB with data: %o', companyId, updateData);
      // updateData уже содержит client_id если он был в исходных данных, sequelize.update это учтет
      await company.update(updateData, { transaction: t }); 
      
      // Получаем обновленную компанию с присоединенным клиентом
      updatedCompany = await Company.findByPk(companyId, {
          include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
          transaction: t
      });

      logger.info('[CompanyService.updateCompany] Company ID %s updated successfully.', companyId);
    });
    return updatedCompany;
  } catch (error) {
    logger.error('[CompanyService.updateCompany] Failed to update company ID %s. Error: %s', companyId, error.message, { error, updateData });
    throw error;
  }
}

async function deleteCompany(companyId) {
  logger.debug('[CompanyService.deleteCompany] Attempting to delete company ID: %s', companyId);
  try {
    await sequelize.transaction(async (t) => {
      const company = await Company.findByPk(companyId, { transaction: t });
      if (!company) {
        logger.warn('[CompanyService.deleteCompany] Company not found for ID: %s', companyId);
        const error = new Error('Компания не найдена');
        error.status = 404;
        throw error;
      }

      // Здесь можно добавить проверки на связанные сущности, если это требуется бизнес-логикой
      // Например, проверить, есть ли у компании связанные представители, и если да, то не удалять
      // или удалять каскадно (если настроено в модели) или отвязывать их.
      // Пока что просто удаляем компанию.

      await company.destroy({ transaction: t });
      logger.info('[CompanyService.deleteCompany] Company ID: %s deleted successfully.', companyId);
    });
    // Для операции удаления обычно ничего не возвращают или возвращают подтверждение (например, true)
    return true; 
  } catch (error) {
    // Обработка специфических ошибок Sequelize, если необходимо (например, ForeignKeyConstraintError)
    logger.error('[CompanyService.deleteCompany] Failed to delete company ID %s. Error: %s', companyId, error.message, { error });
    throw error;
  }
}

// TODO: Реализовать методы сервиса

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
}; 