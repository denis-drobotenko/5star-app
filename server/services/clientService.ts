import { Client, Company, User, sequelize } from '../../shared/models/index.js';
import { s3Client, S3_BUCKET_NAME } from '../config/s3.js';
import { Upload } from "@aws-sdk/lib-storage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

async function getAllClients() {
  logger.debug('[ClientService.getAllClients] Starting to fetch all clients with company and user details.');
  try {
    const clients = await Client.findAll({
      include: [
        { model: Company, as: 'companies', attributes: ['id', 'name'] },
        { model: User, as: 'users', attributes: ['id', 'username', 'full_name', 'email', 'user_type'], where: { user_type: 'CLIENT'}, required: false }
      ]
    });
    logger.info(`[ClientService.getAllClients] Successfully fetched ${clients.length} clients. Sample client: %o`, 
      clients[0] ? {
        id: (clients[0] as any).id,
        name: (clients[0] as any).name,
        companiesCount: (clients[0] as any).companies?.length,
        usersCount: (clients[0] as any).users?.length
      } : 'no clients'
    );
    return clients;
  } catch (error) {
    logger.error('[ClientService.getAllClients] Error fetching clients: %s', (error as any).message, {
      stack: (error as any).stack,
      sequelizeError: (error as any).original ? (error as any).original.message : null
    });
    throw error;
  }
}

async function getClientById(clientId: any) {
  logger.debug('[ClientService.getClientById] Fetching client by ID: %s', clientId);
  try {
    const client: any = await Client.findByPk(clientId, {
      include: [
        { model: Company, as: 'companies', attributes: ['id', 'name', 'inn'] },
        { model: User, as: 'users', attributes: ['id', 'username', 'full_name', 'email', 'phone', 'position', 'user_type'], where: { user_type: 'CLIENT'}, required: false }
      ]
    });
    if (!client) {
      logger.warn('[ClientService.getClientById] Client not found for ID: %s', clientId);
      return null; // или можно выбрасывать кастомную ошибку NotFoundError
    }
    logger.info('[ClientService.getClientById] Successfully fetched client ID: %s', clientId);
    return client;
  } catch (error: any) {
    logger.error('[ClientService.getClientById] Error fetching client ID %s: %s', clientId, (error as any).message, { error });
    throw error;
  }
}

async function createClient(clientData: any, logoFile: any) {
  const { name } = clientData;
  let logoUrl: any = null;
  let newClient: any;

  logger.debug('[ClientService.createClient] Attempting to create client. Name: %s, File provided: %s',
    name, !!logoFile
  );

  try {
    await sequelize.transaction(async (t: any) => {
      if (logoFile) {
        if (!S3_BUCKET_NAME) {
          logger.error('[ClientService.createClient] S3_BUCKET_NAME is not configured. Cannot upload logo.');
          throw new Error('S3 bucket name is not configured. Cannot upload logo.');
        }
        const fileExtension = logoFile.originalname.split('.').pop();
        const fileName = `logos/clients/${uuidv4()}.${fileExtension}`;

        const params = {
          Bucket: S3_BUCKET_NAME,
          Key: fileName,
          Body: logoFile.buffer,
          ContentType: logoFile.mimetype,
          ACL: 'public-read' as any,
        };

        try {
          logger.debug('[ClientService.createClient] Uploading logo to S3. Key: %s', fileName);
          const upload = new Upload({
            client: s3Client,
            params: params,
          });
          const s3UploadResponse = await upload.done();
          if (s3UploadResponse && s3UploadResponse.Location) {
            logoUrl = s3UploadResponse.Location;
            logger.info('[ClientService.createClient] Logo uploaded to S3. URL: %s', logoUrl);
          } else {
            logger.error('[ClientService.createClient] S3 upload did not return a Location.', { s3Response: s3UploadResponse });
            throw new Error('Failed to get S3 URL after logo upload.');
          }
        } catch (s3Error: any) {
          logger.error('[ClientService.createClient] S3 upload failed. Key: %s. Error: %s', fileName, (s3Error as any).message, { error: s3Error });
          throw s3Error; // Propagate error to rollback transaction
        }
      }

      const newClientData = { name };
      if (logoUrl) {
        (newClientData as any).logo_url = logoUrl;
      }
      logger.debug('[ClientService.createClient] Creating client in DB: %o', newClientData);
      newClient = await Client.create(newClientData, { transaction: t });
      logger.info('[ClientService.createClient] Client created in DB. ID: %s, Name: %s', (newClient as any).id, (newClient as any).name);
    });
    return newClient;
  } catch (error: any) {
    logger.error('[ClientService.createClient] Failed to create client. Name: %s. Error: %s', name, (error as any).message, { error });
    // Если ошибка валидации Sequelize, она будет содержать поле `errors`
    // Другие ошибки (S3, конфигурация) будут переброшены как есть
    throw error; 
  }
}

async function updateClient(clientId: any, updateData: any, logoFile?: any, removeLogoFlag?: string) {
  const { name } = updateData;
  let updatedClient: any;

  logger.debug('[ClientService.updateClient] Attempting to update client ID: %s. Data: %o, New logo: %s, Remove logo: %s',
    clientId, updateData, !!logoFile, removeLogoFlag
  );

  try {
    await sequelize.transaction(async (t: any) => {
      const client: any = await Client.findByPk(clientId, { transaction: t });
      if (!client) {
        logger.warn('[ClientService.updateClient] Client not found for ID: %s', clientId);
        const error: any = new Error('Client not found');
        (error as any).status = 404;
        throw error;
      }

      let newLogoUrl = (client as any).logo_url;
      const oldLogoKey = (client as any).logo_url ? (client as any).logo_url.substring((client as any).logo_url.lastIndexOf('logos/')) : null;

      if ((removeLogoFlag === 'true' || logoFile) && oldLogoKey && S3_BUCKET_NAME) {
        try {
          logger.debug('[ClientService.updateClient] Deleting old logo from S3. Key: %s', oldLogoKey);
          await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldLogoKey }));
          logger.info('[ClientService.updateClient] Old logo deleted from S3. Key: %s', oldLogoKey);
          if (removeLogoFlag === 'true' && !logoFile) {
            newLogoUrl = null;
          }
        } catch (s3Error: any) {
          logger.error('[ClientService.updateClient] Failed to delete old logo from S3. Key: %s. Error: %s', oldLogoKey, (s3Error as any).message, { error: s3Error });
          throw s3Error;
        }
      }

      if (logoFile) {
        if (!S3_BUCKET_NAME) {
          logger.error('[ClientService.updateClient] S3_BUCKET_NAME is not configured. Cannot upload new logo.');
          throw new Error('S3 bucket name is not configured. Cannot upload logo.');
        }
        const fileExtension = logoFile.originalname.split('.').pop();
        const fileName = `logos/clients/${uuidv4()}.${fileExtension}`;
        const params = {
          Bucket: S3_BUCKET_NAME,
          Key: fileName,
          Body: logoFile.buffer,
          ContentType: logoFile.mimetype,
          ACL: 'public-read' as any,
        };
        try {
          logger.debug('[ClientService.updateClient] Uploading new logo to S3. Key: %s', fileName);
          const upload = new Upload({ client: s3Client, params: params });
          const s3UploadResponse = await upload.done();
          if (s3UploadResponse && s3UploadResponse.Location) {
            newLogoUrl = s3UploadResponse.Location;
            logger.info('[ClientService.updateClient] New logo uploaded to S3. URL: %s', newLogoUrl);
          } else {
            logger.error('[ClientService.updateClient] New S3 logo upload did not return a Location.');
            throw new Error('Failed to get S3 URL after new logo upload.');
          }
        } catch (s3Error: any) {
          logger.error('[ClientService.updateClient] Failed to upload new logo to S3. Key: %s. Error: %s', fileName, (s3Error as any).message, { error: s3Error });
          throw s3Error;
        }
      }

      const clientUpdateData = { name };
      if (name !== undefined) clientUpdateData.name = name;
      if (newLogoUrl !== (client as any).logo_url) {
        (clientUpdateData as any).logo_url = newLogoUrl;
      }
      
      let hasUpdates = false;
      if (name !== undefined && name !== (client as any).name) hasUpdates = true;
      if (newLogoUrl !== (client as any).logo_url) hasUpdates = true;

      if (hasUpdates) {
        logger.debug('[ClientService.updateClient] Updating client in DB. ID: %s, Data: %o', clientId, clientUpdateData);
        await (client as any).update(clientUpdateData, { transaction: t });
        logger.info('[ClientService.updateClient] Client updated in DB. ID: %s', clientId);
      } else {
        logger.info('[ClientService.updateClient] No changes to update for client ID: %s', clientId);
      }
      updatedClient = await Client.findByPk(clientId, { transaction: t });
    });
    return updatedClient;
  } catch (error: any) {
    logger.error('[ClientService.updateClient] Failed to update client ID %s. Error: %s', clientId, (error as any).message, { error });
    throw error;
  }
}

async function deleteClient(clientId: any) {
  logger.debug('[ClientService.deleteClient] Attempting to delete client ID: %s', clientId);
  try {
    await sequelize.transaction(async (t: any) => {
      const client: any = await Client.findByPk(clientId, { transaction: t });
      if (!client) {
        logger.warn('[ClientService.deleteClient] Client not found for ID: %s', clientId);
        const error: any = new Error('Client not found');
        (error as any).status = 404;
        throw error;
      }

      const logoKey = (client as any).logo_url ? (client as any).logo_url.substring((client as any).logo_url.lastIndexOf('logos/')) : null;
      if (logoKey && S3_BUCKET_NAME) {
        try {
          logger.debug('[ClientService.deleteClient] Deleting logo from S3. Key: %s', logoKey);
          await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: logoKey }));
          logger.info('[ClientService.deleteClient] Logo deleted from S3. Key: %s', logoKey);
        } catch (s3Error: any) {
          logger.error('[ClientService.deleteClient] Failed to delete logo from S3. Key: %s. Error: %s', logoKey, (s3Error as any).message, { error: s3Error });
          throw s3Error; // Откат транзакции, если не удалось удалить логотип
        }
      } else if (logoKey && !S3_BUCKET_NAME) {
        logger.warn('[ClientService.deleteClient] Client logo exists (%s) but S3_BUCKET_NAME is not configured. Logo cannot be deleted from S3.', logoKey);
        // Можно решить, прерывать ли операцию, если бакет не настроен. 
        // В данном случае, продолжим удаление из БД, но логотип останется в S3 если бакет настроят позже.
      }

      await client.destroy({ transaction: t });
      logger.info('[ClientService.deleteClient] Client ID: %s deleted successfully from DB.', clientId);
    });
    // Если транзакция успешна, ничего не возвращаем (или можем вернуть true/статус)
    return true;
  } catch (error: any) {
    logger.error('[ClientService.deleteClient] Failed to delete client ID %s. Error: %s', clientId, (error as any).message, { error });
    throw error;
  }
}

export default {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
}; 