const { DataTypes } = require('sequelize');
const sequelize = require('../../server/config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'clients',
      key: 'id'
    },
    index: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  inn: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  kpp: {
    type: DataTypes.STRING
  },
  legal_address: {
    type: DataTypes.STRING
  },
  postal_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  actual_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bank_details: {
    type: DataTypes.STRING
  },
  edo_provider_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'companies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = Company; 