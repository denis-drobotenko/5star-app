'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Clients
    await queryInterface.createTable('clients', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      logo_url: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // 2. Companies (depends on Clients)
    await queryInterface.createTable('companies', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      client_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'clients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      name: { type: Sequelize.STRING, allowNull: false },
      inn: { type: Sequelize.STRING, allowNull: false, unique: true },
      kpp: { type: Sequelize.STRING, allowNull: true },
      legal_address: { type: Sequelize.STRING, allowNull: true },
      postal_address: { type: Sequelize.STRING, allowNull: true },
      actual_address: { type: Sequelize.STRING, allowNull: true },
      bank_details: { type: Sequelize.STRING, allowNull: true },
      edo_provider_name: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // 3. Users (depends on Clients, Companies)
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      username: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      full_name: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      position: { type: Sequelize.STRING, allowNull: true },
      role: { type: Sequelize.STRING, allowNull: false },
      user_type: { type: Sequelize.STRING, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true, allowNull: false },
      client_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'clients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      company_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      reset_password_token: { type: Sequelize.STRING, allowNull: true },
      reset_password_expires_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // 4. Field Mappings (depends on Clients)
    await queryInterface.createTable('field_mappings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      client_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'clients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING(255), allowNull: false },
      mapping: { type: Sequelize.JSONB, allowNull: false },
      sample_data_url: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addIndex('field_mappings', ['client_id'], { name: 'idx_field_mappings_client_id' });
    await queryInterface.addIndex('field_mappings', ['mapping'], { name: 'idx_field_mappings_mapping', using: 'gin' });
    await queryInterface.addIndex('field_mappings', ['sample_data_url'], { name: 'idx_field_mappings_sample_data_url' });

    // 5. Import History (depends on Clients, Users, Field Mappings)
    await queryInterface.createTable('import_history', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      client_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'clients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      file_name: { type: Sequelize.STRING, allowNull: false },
      custom_name: { type: Sequelize.STRING, allowNull: true },
      source_type: { type: Sequelize.STRING, allowNull: true },
      source_link: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false },
      field_mapping_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'field_mappings', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // 6. Orders (depends on Clients, Import History)
    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      city: { type: Sequelize.STRING, allowNull: true },
      subdivision: { type: Sequelize.STRING, allowNull: true },
      pick_up_point: { type: Sequelize.STRING, allowNull: true },
      order_number: { type: Sequelize.STRING, allowNull: true },
      order_date: { type: Sequelize.DATE, allowNull: true },
      delivery_date: { type: Sequelize.DATE, allowNull: true },
      customer_id: { type: Sequelize.STRING, allowNull: true },
      telephone: { type: Sequelize.STRING, allowNull: true },
      name: { type: Sequelize.STRING, allowNull: true },
      last_name: { type: Sequelize.STRING, allowNull: true },
      birthday: { type: Sequelize.DATEONLY, allowNull: true },
      car_brand: { type: Sequelize.STRING, allowNull: true },
      car_model: { type: Sequelize.STRING, allowNull: true },
      category: { type: Sequelize.STRING, allowNull: true },
      brand: { type: Sequelize.STRING, allowNull: true },
      article_number: { type: Sequelize.STRING, allowNull: true },
      product: { type: Sequelize.STRING, allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: true },
      revenue: { type: Sequelize.FLOAT, allowNull: true },
      cost_price: { type: Sequelize.FLOAT, allowNull: true },
      entry_date: { type: Sequelize.DATE, allowNull: true },
      entry_user: { type: Sequelize.STRING, allowNull: true }, 
      session_id: { 
        type: Sequelize.INTEGER, 
        allowNull: true, 
        references: { model: 'import_history', key: 'id' }, 
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL' 
      },
      client_id: {
        type: Sequelize.INTEGER, 
        allowNull: true, 
        references: { model: 'clients', key: 'id' }, 
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL'
      }
    });
  },

  async down (queryInterface, Sequelize) {
    // Drop in reverse order of creation
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('import_history');
    await queryInterface.dropTable('field_mappings');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('companies');
    await queryInterface.dropTable('clients');
  }
};
