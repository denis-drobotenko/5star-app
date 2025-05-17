const { Client, Company, User } = require('../models');
const { s3, S3_BUCKET_NAME } = require('../config/s3'); // Импорт S3 конфигурации
const logger = require('../config/logger'); // Предполагаем, что логгер есть
const { v4: uuidv4 } = require('uuid'); // Для генерации уникальных имен файлов

/**
 * Получить список всех клиентов.
 * @route GET /api/clients
 * @group Clients - Операции с клиентами
 * @returns {Array<Client>} 200 - Список клиентов
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req, res) {
  try {
    const clients = await Client.findAll({
      include: [
        { model: Company, as: 'companies', attributes: ['id', 'name'] },
        { model: User, as: 'users', attributes: ['id', 'username', 'full_name', 'email', 'user_type'], where: { user_type: 'CLIENT'}, required: false }
      ]
    });
    res.json(clients);
  } catch (error) {
    logger.error('Ошибка при получении клиентов:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Ошибка сервера при получении клиентов', error: error.message });
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
async function getById(req, res) {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [
        { model: Company, as: 'companies', attributes: ['id', 'name', 'inn'] },
        { model: User, as: 'users', attributes: ['id', 'username', 'full_name', 'email', 'phone', 'position', 'user_type'], where: { user_type: 'CLIENT'}, required: false }
      ]
    });
    if (!client) {
      return res.status(404).json({ message: 'Клиент не найден' });
    }
    res.json(client);
  } catch (error) {
    logger.error(`Ошибка при получении клиента ${req.params.id}:`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Ошибка сервера при получении клиента', error: error.message });
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
async function create(req, res) {
  const { name } = req.body;
  logger.info('[ClientController Create] Попытка создания клиента:', { name: name, fileInfo: req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : 'No file uploaded' });

  if (!name) {
    logger.warn('[ClientController Create] Ошибка: Название клиента (name) является обязательным полем.');
    return res.status(400).json({ message: 'Название клиента (name) является обязательным полем.' });
  }

  let logoUrl = null;

  if (req.file && S3_BUCKET_NAME) {
    const file = req.file;
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `logos/clients/${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    try {
      const s3UploadResponse = await s3.upload(params).promise();
      
      if (s3UploadResponse && s3UploadResponse.Location) {
        logoUrl = s3UploadResponse.Location;
        logger.info(`[ClientController Create] Файл успешно загружен в S3. URL: ${logoUrl}`);
      } else {
        logger.error('[ClientController Create] Ошибка: S3 не вернул Location после загрузки.', { s3Response: s3UploadResponse });
      }
    } catch (s3Error) {
      logger.error(`[ClientController Create] ЯВНАЯ ОШИРКА S3 Message: ${s3Error.message}`);
      logger.error(`[ClientController Create] ЯВНАЯ ОШИРКА S3 Code: ${s3Error.code}`);
      logger.error(`[ClientController Create] ЯВНАЯ ОШИРКА S3 RequestId: ${s3Error.requestId}`);
      logger.error(`[ClientController Create] ЯВНАЯ ОШИРКА S3 HostId: ${s3Error.hostId}`);
      logger.error('[ClientController Create] ЯВНАЯ ОШИРКА S3 Stack: ' + s3Error.stack);

      logger.error('[ClientController Create] Ошибка при загрузке файла в S3 (стандартный лог):', { errorMessage: s3Error.message, stack: s3Error.stack, errorObject: s3Error });
      return res.status(500).json({ message: 'Ошибка при загрузке логотипа в S3.', errorDetail: s3Error.message });
    }
  } else {
    if (!req.file) {
    }
    if (!S3_BUCKET_NAME && req.file) {
        logger.warn('[ClientController Create] S3_BUCKET_NAME не определен, хотя файл для загрузки предоставлен. Логотип не будет загружен.');
    }
  }

  try {
    const newClientData = { name };
    if (logoUrl) {
      newClientData.logo_url = logoUrl;
    }

    const newClient = await Client.create(newClientData);
    logger.info('[ClientController Create] Клиент успешно создан в БД:', { clientId: newClient.id, clientName: newClient.name, logoUrl: newClient.logo_url });
    res.status(201).json(newClient);
  } catch (dbError) {
    logger.error('[ClientController Create] Ошибка при создании клиента в БД:', { errorMessage: dbError.message, stack: dbError.stack, errorObject: dbError });
    if (dbError.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + dbError.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера при создании клиента.', error: dbError.message });
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
async function update(req, res) {
  const { id } = req.params;
  const { name, removeLogo } = req.body;
  logger.info(`[ClientController Update] Попытка обновления клиента ID: ${id}`, { name, file: req.file ? req.file.originalname : 'No new file', removeLogo });

  try {
    const client = await Client.findByPk(id);
    if (!client) {
      logger.warn(`[ClientController Update] Клиент ID: ${id} не найден.`);
      return res.status(404).json({ message: 'Клиент не найден' });
    }

    if (name !== undefined) {
      client.name = name;
    }

    let newLogoUrl = client.logo_url;

    const oldLogoKey = client.logo_url ? client.logo_url.substring(client.logo_url.lastIndexOf(S3_BUCKET_NAME + '/') + (S3_BUCKET_NAME + '/').length) : null;
    
    if (req.file || (removeLogo === 'true' && oldLogoKey)) {
        if (oldLogoKey) {
            try {
                await s3.deleteObject({ Bucket: S3_BUCKET_NAME, Key: oldLogoKey }).promise();
                logger.info(`[ClientController Update] Старый логотип ${oldLogoKey} успешно удален из S3.`);
                newLogoUrl = null;
            } catch (s3DeleteError) {
                logger.error(`[ClientController Update] Ошибка при удалении старого логотипа ${oldLogoKey} из S3:`, { error: s3DeleteError.message, stack: s3DeleteError.stack });
            }
        }
    }

    if (req.file) {
      const file = req.file;
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `logos/clients/${uuidv4()}.${fileExtension}`;
      const s3UploadParams = {
        Bucket: S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      try {
        const s3UploadResponse = await s3.upload(s3UploadParams).promise();
        newLogoUrl = s3UploadResponse.Location;
        logger.info(`[ClientController Update] Новый файл успешно загружен в S3. URL: ${newLogoUrl}`);
      } catch (s3Error) {
        logger.error('[ClientController Update] Ошибка при загрузке нового файла в S3:', { error: s3Error.message, stack: s3Error.stack });
        return res.status(500).json({ message: 'Ошибка при загрузке нового логотипа в S3.', error: s3Error.message });
      }
    } else if (removeLogo === 'true') {
        newLogoUrl = null;
    }
    
    client.logo_url = newLogoUrl;
    await client.save();
    logger.info(`[ClientController Update] Клиент ID: ${id} успешно обновлен в БД.`, { clientId: client.id, clientName: client.name, newLogoUrl: client.logo_url });
    res.json(client);

  } catch (dbError) {
    logger.error(`[ClientController Update] Ошибка при обновлении клиента ID: ${id} в БД:`, { error: dbError.message, stack: dbError.stack });
    if (dbError.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Ошибка валидации: ' + dbError.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера при обновлении клиента.', error: dbError.message });
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
async function remove(req, res) {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: ['companies', 'users']
    });
    if (!client) {
      return res.status(404).json({ message: 'Клиент не найден' });
    }

    if (client.companies && client.companies.length > 0) {
      return res.status(400).json({ message: 'Невозможно удалить клиента, так как с ним связаны юрлица. Сначала удалите или отвяжите их.' });
    }
    const clientUsers = await User.count({ where: { client_id: req.params.id, user_type: 'CLIENT' } });
    if (clientUsers > 0) {
       return res.status(400).json({ message: 'Невозможно удалить клиента, так как с ним связаны пользователи-клиенты. Сначала удалите или отвяжите их.' });
    }
    
    if (client.logo_url) {
      const logoKey = client.logo_url.substring(client.logo_url.lastIndexOf(S3_BUCKET_NAME + '/') + (S3_BUCKET_NAME + '/').length);
      try {
        await s3.deleteObject({ Bucket: S3_BUCKET_NAME, Key: logoKey }).promise();
        logger.info(`[ClientController Remove] Логотип ${logoKey} успешно удален из S3.`);
      } catch (s3DeleteError) {
        logger.error(`[ClientController Remove] Ошибка при удалении логотипа ${logoKey} из S3:`, { error: s3DeleteError.message, stack: s3DeleteError.stack });
      }
    }

    await client.destroy();
    logger.info(`[ClientController Remove] Клиент ID: ${req.params.id} успешно удален из БД.`);
    res.json({ message: 'Клиент успешно удален' });
  } catch (error) {
    logger.error(`Ошибка при удалении клиента ${req.params.id}:`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Ошибка сервера при удалении клиента', error: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove }; 