const { DataTypes } = require('sequelize');
const sequelize = require('../../server/config/database');

const FieldMapping = sequelize.define('FieldMapping', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mapping: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  sample_data_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL файла с примером данных в S3'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.fn('NOW')
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.fn('NOW')
  }
}, {
  tableName: 'field_mappings',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      name: 'idx_field_mappings_client_id',
      fields: ['client_id']
    },
    {
      name: 'idx_field_mappings_mapping',
      using: 'gin',
      fields: ['mapping']
    },
    {
      name: 'idx_field_mappings_sample_data_url',
      fields: ['sample_data_url']
    }
  ]
});

module.exports = FieldMapping; 