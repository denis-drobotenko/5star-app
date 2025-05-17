const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FieldMapping = sequelize.define('FieldMapping', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'companies',
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
      name: 'idx_field_mappings_company_id',
      fields: ['company_id']
    },
    {
      name: 'idx_field_mappings_mapping',
      using: 'gin',
      fields: ['mapping']
    }
  ]
});

module.exports = FieldMapping; 