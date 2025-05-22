'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('import_history', 's3_key_original_file', {
      type: Sequelize.STRING, // или Sequelize.TEXT, если ожидаются очень длинные ключи
      allowNull: true, // или false, если поле обязательно
      // defaultValue: null, // Можно указать значение по умолчанию, если необходимо
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('import_history', 's3_key_original_file');
  }
};
