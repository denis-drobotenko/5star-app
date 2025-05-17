const Company = require('../models').Company;
const Client = require('../models').Client;

/**
 * Получить список всех компаний
 * @route GET /api/companies
 * @group Companies - Операции с компаниями (юрлицами клиентов)
 * @param {integer} [clientId] - ID клиента для фильтрации компаний (req.query.clientId)
 * @returns {Array<Company>} 200 - Список компаний
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req, res) {
  try {
    const { clientId } = req.query;
    const whereClause = {};
    if (clientId) {
      whereClause.client_id = clientId;
    }
    const companies = await Company.findAll({ where: whereClause });
    res.json(companies);
  } catch (err) {
    console.error('Ошибка при получении компаний:', err);
    res.status(500).json({ message: 'Ошибка сервера при получении компаний', error: err.message });
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
async function getById(req, res) {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: 'Компания не найдена' });
    res.json(company);
  } catch (err) {
    console.error(`Ошибка при получении компании ${req.params.id}:`, err);
    res.status(500).json({ message: 'Ошибка сервера при получении компании', error: err.message });
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
async function create(req, res) {
  const { client_id, name, inn } = req.body;

  if (!client_id || !name || !inn) {
    return res.status(400).json({ message: 'Пожалуйста, укажите client_id, name и inn' });
  }

  try {
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(400).json({ message: `Клиент с ID ${client_id} не найден` });
    }

    const companyData = { ...req.body };
    delete companyData.contact_persons;

    const company = await Company.create(companyData);
    res.status(201).json(company);
  } catch (err) {
    console.error('Ошибка при создании компании:', err);
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера при создании компании', error: err.message });
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
async function update(req, res) {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: 'Компания не найдена' });

    const { client_id } = req.body;
    if (client_id && client_id !== company.client_id) {
      const client = await Client.findByPk(client_id);
      if (!client) {
        return res.status(400).json({ message: `Клиент с ID ${client_id} для смены привязки не найден` });
      }
    }
    const companyData = { ...req.body };
    delete companyData.contact_persons;

    await company.update(companyData);
    res.json(company);
  } catch (err) {
    console.error(`Ошибка при обновлении компании ${req.params.id}:`, err);
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка обновления', error: err.message });
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
async function remove(req, res) {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: 'Компания не найдена' });
    await company.destroy();
    res.json({ message: 'Компания удалена' });
  } catch (err) {
    console.error(`Ошибка при удалении компании ${req.params.id}:`, err);
    res.status(500).json({ message: 'Ошибка сервера при удалении компании', error: err.message });
  }
}

module.exports = { getAll, getById, create, update, remove }; 