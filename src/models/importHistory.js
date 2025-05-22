const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Убедитесь, что путь к sequelize корректен

const ImportHistory = sequelize.define('ImportHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  client_id: { // Добавляем/обновляем это поле
    type: DataTypes.INTEGER,
    allowNull: true, // В соответствии с schema.sql, может быть NULL
    references: {
      model: 'clients', // Имя таблицы, на которую ссылаемся
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users', // Имя таблицы, на которую ссылаемся
      key: 'id',
    },
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  custom_name: { // Добавим поле для кастомного названия загрузки
    type: DataTypes.STRING,
    allowNull: true,
  },
  source_type: { // Тип источника (например, 'xlsx', 's3_link')
    type: DataTypes.STRING,
    allowNull: true,
  },
  source_link: { // Ссылка на S3 
    type: DataTypes.STRING,
    allowNull: true, 
  },
  s3_key_original_file: { // Ключ оригинального файла в S3
    type: DataTypes.STRING,
    allowNull: true,
  },
  s3_key_processed_data: { // Ключ файла с успешно обработанными данными для предпросмотра/импорта
    type: DataTypes.STRING,
    allowNull: true,
  },
  s3_key_error_data: { // Ключ файла с данными, которые не прошли обработку/валидацию
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: { // Статус (например, 'file_uploaded', 'processing', 'completed', 'failed')
    type: DataTypes.STRING,
    allowNull: false,
  },
  field_mapping_id: { // ID использованного маппинга
    type: DataTypes.INTEGER,
    allowNull: true, // Может быть true, если загрузка может быть без маппинга, или false если маппинг обязателен
    references: {
      model: 'field_mappings',
      key: 'id',
    },
    // onDelete: 'SET NULL', // или 'RESTRICT' / 'NO ACTION'
    // onUpdate: 'CASCADE',
  },
  rows_total: { // Общее количество строк в исходном файле (после удаления пустых/служебных)
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rows_processed: { // Количество обработанных строк (может отличаться от rows_total если были ошибки до основного цикла)
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rows_successfully_previewed: { // Количество строк, успешно прошедших этап предпросмотра
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rows_failed_preview: { // Количество строк с ошибками на этапе предпросмотра
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rows_successfully_imported: { // Количество строк, успешно вставленных в целевую таблицу
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rows_failed: { // Количество строк, которые не удалось вставить в целевую таблицу (на этапе выполнения)
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status_details: { // Дополнительные детали по статусу или сообщение об ошибке
    type: DataTypes.TEXT, // Используем TEXT для более длинных сообщений
    allowNull: true,
  },
  processing_finished_at: { // Время завершения этапа обработки/предпросмотра
    type: DataTypes.DATE,
    allowNull: true,
  },
  execution_finished_at: { // Время завершения этапа выполнения импорта
    type: DataTypes.DATE,
    allowNull: true,
  },
  error_log: { // Для сохранения стека ошибки или других деталей
    type: DataTypes.JSONB, // Используем JSONB для структурированных логов ошибок
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'import_history',
  timestamps: true, // Sequelize будет управлять полями createdAt и updatedAt
  createdAt: 'created_at',
  updatedAt: 'updated_at', // Включаем updatedAt и указываем имя поля
});

module.exports = ImportHistory; 