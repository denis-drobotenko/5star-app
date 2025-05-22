const { Client, Company, User } = require('../../shared/models');
const { sequelize } = require('../../shared/models'); // Добавляем импорт sequelize
const { s3Client, S3_BUCKET_NAME } = require('../config/s3'); // Изменено s3 на s3Client
const { Upload } = require("@aws-sdk/lib-storage"); // Для s3.upload
const { DeleteObjectCommand } = require("@aws-sdk/client-s3"); // для s3.deleteObject
const logger = require('../config/logger'); // Предполагаем, что логгер есть
const { v4: uuidv4 } = require('uuid'); // Для генерации уникальных имен файлов
const clientService = require('../services/clientService'); // Добавляем импорт сервиса
const {
  validateBody,
  validateParams,
  clientIdSchema,
  createClientSchema,
  updateClientSchema,
} = require('../../shared/validators/clientValidator');

/**
 * Получить список всех клиентов.
 * @route GET /api/clients
 * @group Clients - Операции с клиентами
 * @returns {Array<Client>} 200 - Список клиентов
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req, res, next) {
  logger.info('[ClientController.getAll] Request to get all clients. Headers: %o, User: %o', 
    { authorization: req.headers.authorization ? 'present' : 'missing' },
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const clients = await clientService.getAllClients();
    logger.debug('[ClientController.getAll] Found %d clients. First client: %o', 
      clients.length, 
      clients[0] ? { id: clients[0].id, name: clients[0].name } : 'no clients'
    );
    res.json(clients);
  } catch (error) {
    logger.error('[ClientController.getAll] Failed to get all clients. Error: %s', error.message, {
      error: error,
      stack: error.stack,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Получить клиента по ID.
 * @route GET /api/clients/:id
 * @group Clients - Операции с клиентами
 * @param {integer} id.path.required - ID клиента
 * @returns {Client} 200 - Данные клиента
 * @returns {Error} 404 - Клиент не найден
 * @returns {Error} 500 - Ошибка сервера
 */
async function getById(req, res, next) {
  const clientId = req.params.id;
  logger.info('[ClientController.getById] Request to get client by ID: %s. Requesting user: %o', 
    clientId, 
    req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : { id: 'undefined' }
  );
  try {
    const client = await clientService.getClientById(clientId); // Используем метод сервиса
    if (!client) {
      logger.warn('[ClientController.getById] Client not found for ID: %s', clientId);
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    logger.debug('[ClientController.getById] Client found for ID %s. Sending response: %o', clientId, client);
    res.json(client);
  } catch (error) {
    logger.error('[ClientController.getById] Failed to get client by ID %s. Error: %s', clientId, error.message, {
      error: error,
      clientIdParam: clientId,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role, client_id: req.user.client_id } : null
    });
    next(error);
  }
}

/**
 * Создать нового клиента.
 * @route POST /api/clients
 * @group Clients - Операции с клиентами
 * @param {string} name.formData.required - Название клиента.
 * @param {file} [logoFile.formData] - Файл логотипа клиента (изображение).
 * @returns {Client} 201 - Созданный клиент.
 * @returns {Error} 400 - Ошибка валидации или загрузки файла.
 * @returns {Error} 500 - Ошибка сервера.
 */
async function create(req, res, next) {
  const { name } = req.body;
  const logoFile = req.file; // Получаем файл из req
  const fileInfoLog = req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : 'No file uploaded';
  
  logger.info('[ClientController.create] Attempting to create client. Name: %s. File: %o. Requesting user: %o', 
    name, 
    fileInfoLog, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    // Валидация вынесена в middleware, здесь предполагаем, что данные валидны
    // или специфичная логика валидации, не покрываемая Joi, может быть здесь
    const clientData = { name };
    const newClient = await clientService.createClient(clientData, logoFile);
    
    logger.info('[ClientController.create] Client created successfully. ID: %s, Name: %s, Logo: %s', newClient.id, newClient.name, newClient.logo_url);
    res.status(201).json(newClient);

  } catch (error) {
    logger.error('[ClientController.create] Failed to create client. Name: %s. Error: %s', name, error.message, {
      error: error,
      requestBody: req.body,
      fileInfo: fileInfoLog,
      requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    // Сервис может выбросить ошибку валидации Sequelize или другую ошибку
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    } 
    // Для ошибок типа "S3 bucket name is not configured" или других специфичных ошибок от сервиса
    if (error.message === 'S3 bucket name is not configured. Cannot upload logo.' || error.message === 'Failed to get S3 URL after logo upload.') {
        return res.status(400).json({ message: error.message });
    }
    // Общая ошибка сервера
    next(error);
  }
}

/**
 * Обновить клиента.
 * @route PUT /api/clients/:id
 * @group Clients - Операции с клиентами
 * @param {integer} id.path.required - ID клиента.
 * @param {string} [name.formData] - Новое название клиента.
 * @param {file} [logoFile.formData] - Новый файл логотипа клиента (изображение).
 * @param {string} [removeLogo.formData] - Передайте 'true', если нужно удалить существующий логотип без загрузки нового.
 * @returns {Client} 200 - Обновленный клиент.
 * @returns {Error} 404 - Клиент не найден.
 * @returns {Error} 500 - Ошибка сервера.
 */
async function update(req, res, next) {
  const { id } = req.params;
  const { name, removeLogo } = req.body;
  const logoFile = req.file;
  const fileInfoLog = req.file ? { originalname: req.file.originalname, size: req.file.size } : 'No new file';

  logger.info('[ClientController.update] Attempting to update client ID %s. Name: %s, File: %o, RemoveLogo: %s. Requesting user: %o', 
    id, name, fileInfoLog, removeLogo, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    const updateData = { name };
    const updatedClient = await clientService.updateClient(id, updateData, logoFile, removeLogo);

    if (!updatedClient) { // Эта проверка теперь делается в сервисе, но на всякий случай
      logger.warn('[ClientController.update] Client not found for ID: %s after update attempt.', id);
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    
    logger.info('[ClientController.update] Client ID %s updated successfully. Response: %o', id, updatedClient);
    res.json(updatedClient);

  } catch (error) {
    logger.error('[ClientController.update] Failed to update client ID %s. Error: %s', id, error.message, {
        error: error,
        clientIdParam: id,
        requestBody: req.body,
        fileInfo: fileInfoLog,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    if (error.status === 404 || error.message === 'Client not found') {
        return res.status(404).json({ message: 'Клиент не найден' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + error.errors.map(e => e.message).join(', ') });
    }
    if (error.message === 'S3 bucket name is not configured. Cannot upload logo.' || error.message === 'Failed to get S3 URL after new logo upload.') {
        return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

/**
 * Удалить клиента.
 * @route DELETE /api/clients/:id
 * @group Clients - Операции с клиентами
 * @param {integer} id.path.required - ID клиента
 * @returns {object} 200 - Сообщение об удалении
 * @returns {Error} 404 - Клиент не найден
 * @returns {Error} 400 - Ошибка: невозможно удалить клиента, если с ним связаны компании или пользователи
 * @returns {Error} 500 - Ошибка сервера
 */
async function remove(req, res, next) {
  const { id } = req.params;
  logger.info('[ClientController.remove] Attempting to delete client ID %s. Requesting user: %o', 
    id, 
    req.user ? { id: req.user.id, role: req.user.role } : { id: 'undefined' }
  );

  try {
    await clientService.deleteClient(id);
    logger.info('[ClientController.remove] Client ID %s deleted successfully.', id);
    res.status(204).send(); // Стандартный ответ для успешного удаления без тела

  } catch (error) {
    logger.error('[ClientController.remove] Failed to delete client ID %s. Error: %s', id, error.message, {
        error: error,
        clientIdParam: id,
        requestingUser: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    if (error.status === 404 || error.message === 'Client not found') {
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    // Если сервис выбросил ошибку S3 или другую во время транзакции
    if (error.message.includes('S3')) { // Простая проверка, можно улучшить
        // Ошибка S3 могла произойти, но удаление из БД могло быть отменено транзакцией
        // или наоборот, если удаление из S3 было после удаления из БД (что не рекомендуется)
        // Логика уже в сервисе, здесь просто передаем ошибку дальше
    }
    next(error);
  }
}

module.exports = {
  getAll,
  getById: [validateParams(clientIdSchema), getById],
  create: [validateBody(createClientSchema), create],
  update: [validateParams(clientIdSchema), validateBody(updateClientSchema), update],
  remove: [validateParams(clientIdSchema), remove],
}; 