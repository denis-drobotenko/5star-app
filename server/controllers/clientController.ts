import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';
import clientService from '../services/clientService.js';

/**
 * Получить список всех клиентов.
 * @route GET /api/clients
 * @group Clients - Операции с клиентами
 * @returns {Array<Client>} 200 - Список клиентов
 * @returns {Error} 500 - Ошибка сервера
 */
async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  logger.info('[ClientController.getAll] Request to get all clients. Headers: %o, User: %o', 
    { authorization: req.headers.authorization ? 'present' : 'missing' },
    req.user ? { id: (req.user as any).id, role: (req.user as any).role, client_id: (req.user as any).client_id } : { id: 'undefined' }
  );
  try {
    const clients = await clientService.getAllClients();
    logger.debug('[ClientController.getAll] Found %d clients. First client: %o', 
      clients.length, 
      clients[0] ? { id: clients[0].id, name: clients[0].name } : 'no clients'
    );
    res.json(clients);
  } catch (error: any) {
    logger.error('[ClientController.getAll] Failed to get all clients. Error: %s', error.message, {
      error: error,
      stack: error.stack,
      requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role, client_id: (req.user as any).client_id } : null
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
async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clientId = req.params.id;
  logger.info('[ClientController.getById] Request to get client by ID: %s. Requesting user: %o', 
    clientId, 
    req.user ? { id: (req.user as any).id, role: (req.user as any).role, client_id: (req.user as any).client_id } : { id: 'undefined' }
  );
  try {
    const client = await clientService.getClientById(clientId);
    if (!client) {
      logger.warn('[ClientController.getById] Client not found for ID: %s', clientId);
      res.status(404).json({ message: 'Клиент не найден' });
      return;
    }
    logger.debug('[ClientController.getById] Client found for ID %s. Sending response: %o', clientId, client);
    res.json(client);
  } catch (error: any) {
    logger.error('[ClientController.getById] Failed to get client by ID %s. Error: %s', clientId, error.message, {
      error: error,
      clientIdParam: clientId,
      requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role, client_id: (req.user as any).client_id } : null
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
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { name } = req.body;
  const logoFile = req.file as Express.Multer.File | undefined; // Типизация req.file
  const fileInfoLog = logoFile ? { originalname: logoFile.originalname, mimetype: logoFile.mimetype, size: logoFile.size } : 'No file uploaded';
  
  logger.info('[ClientController.create] Attempting to create client. Name: %s. File: %o. Requesting user: %o', 
    name, 
    fileInfoLog, 
    req.user ? { id: (req.user as any).id, role: (req.user as any).role } : { id: 'undefined' }
  );

  try {
    const clientData = { name };
    const newClient = await clientService.createClient(clientData, logoFile);
    
    logger.info('[ClientController.create] Client created successfully. ID: %s, Name: %s, Logo: %s', newClient.id, newClient.name, newClient.logo_url);
    res.status(201).json(newClient);

  } catch (error: any) {
    logger.error('[ClientController.create] Failed to create client. Name: %s. Error: %s', name, error.message, {
      error: error,
      requestBody: req.body,
      fileInfo: fileInfoLog,
      requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role } : null
    });
    if (error.name === 'SequelizeValidationError') {
      res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    } 
    if (error.message === 'S3 bucket name is not configured. Cannot upload logo.' || error.message === 'Failed to get S3 URL after logo upload.') {
        res.status(400).json({ message: error.message });
        return;
    }
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
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  const { name, removeLogo } = req.body;
  const logoFile = req.file as Express.Multer.File | undefined;
  const fileInfoLog = logoFile ? { originalname: logoFile.originalname, size: logoFile.size } : 'No new file';

  logger.info('[ClientController.update] Attempting to update client ID %s. Name: %s, File: %o, RemoveLogo: %s. Requesting user: %o', 
    id, name, fileInfoLog, removeLogo, 
    req.user ? { id: (req.user as any).id, role: (req.user as any).role } : { id: 'undefined' }
  );

  try {
    const updateData = { name };
    const updatedClient = await clientService.updateClient(id, updateData, logoFile, removeLogo);

    logger.info('[ClientController.update] Client ID %s updated successfully. Response: %o', id, updatedClient);
    res.json(updatedClient);

  } catch (error: any) {
    logger.error('[ClientController.update] Failed to update client ID %s. Error: %s', id, error.message, {
        error: error,
        clientIdParam: id,
        requestBody: req.body,
        fileInfo: fileInfoLog,
        requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role } : null
    });
    if (error.status === 404 || error.message === 'Client not found') {
        res.status(404).json({ message: error.message || 'Клиент не найден' });
        return;
    }
    if (error.name === 'SequelizeValidationError') {
      res.status(400).json({ message: 'Ошибка валидации: ' + (error.errors ? error.errors.map((e: any) => e.message).join(', ') : error.message) });
      return;
    }
    if (error.message === 'S3 bucket name is not configured. Cannot upload logo.' || error.message === 'Failed to get S3 URL after new logo upload.') {
        res.status(400).json({ message: error.message });
        return;
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
async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  logger.info('[ClientController.remove] Attempting to delete client ID %s. Requesting user: %o', 
    id, 
    req.user ? { id: (req.user as any).id, role: (req.user as any).role } : { id: 'undefined' }
  );

  try {
    await clientService.deleteClient(id);
    logger.info('[ClientController.remove] Client ID %s deleted successfully.', id);
    res.status(204).send();

  } catch (error: any) {
    logger.error('[ClientController.remove] Failed to delete client ID %s. Error: %s', id, error.message, {
        error: error,
        clientIdParam: id,
        requestingUser: req.user ? { id: (req.user as any).id, role: (req.user as any).role } : null
    });
    if (error.status === 404 || error.message === 'Client not found') {
      res.status(404).json({ message: error.message || 'Клиент не найден' });
      return;
    }
    if (error.status === 400) { // Например, если клиент связан с другими сущностями
        res.status(400).json({ message: error.message });
        return;
    }
    next(error);
  }
}

export {
  getAll,
  getById,
  create,
  update,
  remove,
}; 