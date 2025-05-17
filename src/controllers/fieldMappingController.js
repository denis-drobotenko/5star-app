const FieldMapping = require('../models/fieldMapping')
const Company = require('../models/company')

class FieldMappingController {
  static async getAll(req, res) {
    try {
      // Если пользователь не админ, показываем только маппинги его компании
      const where = req.user.role !== 'admin' ? { company_id: req.user.company_id } : {};
      
      const mappings = await FieldMapping.findAll({
        where,
        include: [{
          model: Company,
          as: 'company',
          attributes: ['name']
        }],
        order: [['created_at', 'DESC']]
      })
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
          model: Company,
          as: 'company',
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
          model: Company,
          as: 'company',
          attributes: ['name']
        }]
      })
      
      if (!mapping) {
        return res.status(404).json({ message: 'Маппинг не найден' })
      }

      // Проверяем права доступа
      if (req.user.role !== 'admin' && mapping.company_id !== req.user.company_id) {
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
      const { name, mapping } = req.body
      
      // Используем company_id из токена для не-админов
      const company_id = req.user.role === 'admin' && req.body.company_id ? 
        req.body.company_id : req.user.company_id;

      if (!name || !mapping || !company_id) {
        return res.status(400).json({ message: 'Не указано название, маппинг или компания' })
      }

      // Проверяем права доступа
      if (req.user.role !== 'admin' && company_id !== req.user.company_id) {
        return res.status(403).json({ message: 'Нельзя создавать маппинги для другой компании' });
      }

      const result = await FieldMapping.create({
        name,
        mapping,
        company_id
      })
      
      res.status(201).json(result)
    } catch (error) {
      console.error('Error in create:', error)
      res.status(500).json({ message: 'Ошибка при создании маппинга' })
    }
  }

  static async update(req, res) {
    try {
      const { name, mapping } = req.body
      
      if (!name || !mapping) {
        return res.status(400).json({ message: 'Не указано название или маппинг' })
      }

      // Получаем существующий маппинг
      const existingMapping = await FieldMapping.findByPk(req.params.id);
      if (!existingMapping) {
        return res.status(404).json({ message: 'Маппинг не найден' });
      }

      // Проверяем права доступа
      if (req.user.role !== 'admin' && existingMapping.company_id !== req.user.company_id) {
        return res.status(403).json({ message: 'Нет доступа к редактированию маппинга другой компании' });
      }

      const [updated] = await FieldMapping.update({
        name,
        mapping,
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
          model: Company,
          as: 'company',
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
      if (req.user.role !== 'admin' && existingMapping.company_id !== req.user.company_id) {
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
}

module.exports = FieldMappingController 