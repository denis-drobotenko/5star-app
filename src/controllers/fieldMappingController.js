const FieldMapping = require('../models/fieldMapping')
const Client = require('../models/client')
const { s3, S3_BUCKET_NAME } = require('../config/s3')
const logger = require('../config/logger')
const { v4: uuidv4 } = require('uuid')

class FieldMappingController {
  static async getAll(req, res) {
    try {
      // Если пользователь не админ, показываем только маппинги его клиента
      const where = req.user.role !== 'admin' ? { client_id: req.user.client_id } : {};
      
      const mappings = await FieldMapping.findAll({
        where,
        include: [{
          model: Client,
          as: 'client',
          attributes: ['name']
        }],
        order: [['created_at', 'DESC']]
      })

      logger.info('[FieldMappingController.getAll] Маппинги, полученные из БД: ' + JSON.stringify({
        count: mappings.length,
        mappingsData: mappings.map(m => ({ 
          id: m.id, 
          name: m.name, 
          client_id: m.client_id, 
          sample_data_url: m.sample_data_url, 
          mapping_keys: m.mapping ? Object.keys(m.mapping) : null,
        }))
      }, null, 2));

      res.json(mappings)
    } catch (error) {
      console.error('Error in getAll:', error)
      res.status(500).json({ message: 'Ошибка при получении маппингов' })
    }
  }

  static async getByCompanyId(req, res) {
    try {
      // Проверяем права доступа
      if (req.user.role !== 'admin' && req.user.company_id !== parseInt(req.params.companyId)) {
        return res.status(403).json({ message: 'Нет доступа к маппингам другой компании' });
      }

      const mappings = await FieldMapping.findAll({
        where: { company_id: req.params.companyId },
        include: [{
          model: Client,
          as: 'client',
          attributes: ['name']
        }],
        order: [['created_at', 'DESC']]
      })
      res.json(mappings)
    } catch (error) {
      console.error('Error in getByCompanyId:', error)
      res.status(500).json({ message: 'Ошибка при получении маппингов компании' })
    }
  }

  static async getById(req, res) {
    try {
      const mapping = await FieldMapping.findByPk(req.params.id, {
        include: [{
          model: Client,
          as: 'client',
          attributes: ['name']
        }]
      })
      
      if (!mapping) {
        logger.warn(`[FieldMappingController.getById] Маппинг с id ${req.params.id} не найден.`);
        return res.status(404).json({ message: 'Маппинг не найден' })
      }

      logger.info(`[FieldMappingController.getById] Маппинг с id ${req.params.id}, полученный из БД: ' + JSON.stringify({ 
        mappingData: { 
          id: mapping.id, 
          name: mapping.name, 
          client_id: mapping.client_id, 
          sample_data_url: mapping.sample_data_url, 
          mapping_keys: mapping.mapping ? Object.keys(mapping.mapping) : null,
        }
      }, null, 2)`);

      // Проверяем права доступа
      if (req.user.role !== 'admin' && mapping.client_id !== req.user.client_id) {
        return res.status(403).json({ message: 'Нет доступа к маппингу другой компании' });
      }

      res.json(mapping)
    } catch (error) {
      console.error('Error in getById:', error)
      res.status(500).json({ message: 'Ошибка при получении маппинга' })
    }
  }

  static async create(req, res) {
    try {
      const { name, mapping, client_id, sample_data_url } = req.body;
      
      logger.info('[FieldMappingController.create] Попытка создания маппинга. Получено из req.body:', {
        name,
        client_id,
        sample_data_url,
        mappingKeys: mapping ? Object.keys(mapping) : null
      });

      // Используем client_id из тела запроса или из токена для не-админов, если client_id не указан в теле
      // Предпочитаем client_id из тела, если он есть (для админов или если фронтенд его шлет)
      const final_client_id = client_id || (req.user.role !== 'admin' ? req.user.client_id : undefined);

      if (!name || !mapping || !final_client_id) {
        return res.status(400).json({ message: 'Не указано название, маппинг или компания' })
      }

      // Проверяем права доступа: не-админ может создавать маппинги только для своего клиента
      if (req.user.role !== 'admin' && final_client_id !== req.user.client_id) {
        return res.status(403).json({ message: 'Нельзя создавать маппинги для другого клиента' });
      }

      const result = await FieldMapping.create({
        name,
        mapping,
        client_id: final_client_id,
        sample_data_url
      })
      
      logger.info('[FieldMappingController.create] Маппинг успешно создан:', { 
        mappingData: { 
          id: result.id, 
          name: result.name, 
          client_id: result.client_id, 
          sample_data_url: result.sample_data_url, 
          mapping_keys: result.mapping ? Object.keys(result.mapping) : null,
        }
      });

      res.status(201).json(result)
    } catch (error) {
      console.error('Error in create:', error)
      logger.error('Ошибка при создании маппинга в FieldMappingController.create', {
        message: error.message,
        stack: error.stack,
        originalError: error.original,
        requestBody: req.body
      });
      res.status(500).json({ message: 'Ошибка при создании маппинга' })
    }
  }

  static async update(req, res) {
    try {
      const { name, mapping, sample_data_url } = req.body;
      
      logger.info(`[FieldMappingController.update] Попытка обновления маппинга id: ${req.params.id}. Получено из req.body:`, {
        name,
        sample_data_url,
        mappingKeys: mapping ? Object.keys(mapping) : null
      });

      if (!name || !mapping) {
        return res.status(400).json({ message: 'Не указано название или маппинг' })
      }

      // Получаем существующий маппинг
      const existingMapping = await FieldMapping.findByPk(req.params.id);
      if (!existingMapping) {
        return res.status(404).json({ message: 'Маппинг не найден' });
      }

      // Проверяем права доступа
      if (req.user.role !== 'admin' && existingMapping.client_id !== req.user.client_id) {
        return res.status(403).json({ message: 'Нет доступа к редактированию маппинга другой компании' });
      }

      const [updated] = await FieldMapping.update({
        name,
        mapping,
        sample_data_url,
        updated_at: new Date()
      }, {
        where: { id: req.params.id },
        returning: true
      })

      if (!updated) {
        return res.status(404).json({ message: 'Маппинг не найден' })
      }

      const result = await FieldMapping.findByPk(req.params.id, {
        include: [{
          model: Client,
          as: 'client',
          attributes: ['name']
        }]
      })
      res.json(result)
    } catch (error) {
      console.error('Error in update:', error)
      res.status(500).json({ message: 'Ошибка при обновлении маппинга' })
    }
  }

  static async delete(req, res) {
    try {
      // Получаем существующий маппинг
      const existingMapping = await FieldMapping.findByPk(req.params.id);
      if (!existingMapping) {
        return res.status(404).json({ message: 'Маппинг не найден' });
      }

      // Проверяем права доступа
      if (req.user.role !== 'admin' && existingMapping.client_id !== req.user.client_id) {
        return res.status(403).json({ message: 'Нет доступа к удалению маппинга другой компании' });
      }

      const deleted = await FieldMapping.destroy({
        where: { id: req.params.id }
      })

      if (!deleted) {
        return res.status(404).json({ message: 'Маппинг не найден' })
      }

      res.json({ message: 'Маппинг удален' })
    } catch (error) {
      console.error('Error in delete:', error)
      res.status(500).json({ message: 'Ошибка при удалении маппинга' })
    }
  }

  /**
   * Загрузить пример данных в S3.
   * @route POST /api/field-mappings/upload-sample
   * @group FieldMappings - Операции с маппингами полей
   * @param {object} req.body.required - Данные для сохранения (поля и примеры)
   * @returns {object} 200 - URL сохраненного файла
   * @returns {Error} 500 - Ошибка сервера
   */
  static async uploadSample(req, res) {
    const fileName = `field-mapping-samples/${uuidv4()}.json`;
    try {
      if (!req.body || !req.body.fields || !req.body.examples) {
        return res.status(400).json({ message: 'Отсутствуют необходимые данные (fields и examples) для сохранения примера.' });
      }

      let stringifiedBody;
      try {
        stringifiedBody = JSON.stringify(req.body, null, 2);
      } catch (stringifyError) {
        console.error('Error stringifying sample data body:', stringifyError);
        return res.status(400).json({ message: 'Ошибка при обработке данных для сохранения (JSON): ' + stringifyError.message });
      }

      try {
        await s3.putObject({
          Bucket: S3_BUCKET_NAME,
          Key: fileName,
          Body: stringifiedBody,
          ContentType: 'application/json'
        }).promise();
      } catch (s3PutError) {
        console.error('S3 putObject error in uploadSample:', s3PutError);
        return res.status(500).json({ message: 'Ошибка при загрузке примера данных в S3 (putObject): ' + s3PutError.message });
      }

      const url = `${process.env.S3_ENDPOINT}/${S3_BUCKET_NAME}/${fileName}`;
      let signedUrl;
      try {
        const params = {
          Bucket: S3_BUCKET_NAME,
          Key: fileName,
          Expires: 3600
        };
        signedUrl = await s3.getSignedUrlPromise('getObject', params);
      } catch (s3SignError) {
        console.error('S3 getSignedUrlPromise error in uploadSample:', s3SignError);
        return res.status(500).json({ message: 'Ошибка при получении подписанной ссылки для примера данных (getSignedUrl): ' + s3SignError.message });
      }
      
      res.json({ url, key: fileName, signedUrl });

    } catch (error) { // General catch for any other unexpected errors
      const uniqueErrorMessage = 'ПОСЛЕДНИЙ РУБЕЖ ОШИБОК в fieldMappingController.uploadSample: ' + (error.message || 'Неизвестная ошибка');
      console.error('ПОЛНЫЙ ПРОВАЛ в uploadSample:', error, uniqueErrorMessage);
      res.status(500).json({ message: uniqueErrorMessage, originalErrorStack: error.stack });
    }
  }

  /**
   * Получить подписанный URL для доступа к файлу в S3.
   * @route GET /api/field-mappings/get-signed-url
   * @group FieldMappings - Операции с маппингами полей
   * @param {string} key.query.required - Ключ файла в S3
   * @returns {object} 200 - Подписанный URL для доступа к файлу
   * @returns {Error} 400 - Не указан ключ файла
   * @returns {Error} 500 - Ошибка сервера
   */
  static async getSignedUrl(req, res) {
    try {
      const { key } = req.query;
      
      if (!key) {
        return res.status(400).json({ message: 'Не указан ключ файла' });
      }

      const params = {
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Expires: 3600 // URL будет действителен 1 час
      };

      const signedUrl = await s3.getSignedUrlPromise('getObject', params);
      
      res.json({ signedUrl });
    } catch (error) {
      console.error('Error getting signed URL:', error);
      res.status(500).json({ message: 'Ошибка при получении ссылки на файл' });
    }
  }
}

module.exports = FieldMappingController 