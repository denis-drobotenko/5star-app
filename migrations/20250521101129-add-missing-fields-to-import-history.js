'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Эти колонки уже существуют из-за предыдущего частичного применения
    await queryInterface.addColumn('import_history', 's3_key_processed_data', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('import_history', 's3_key_error_data', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('import_history', 'rows_total', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'rows_processed', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'rows_successfully_previewed', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'rows_failed_preview', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'rows_successfully_imported', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'rows_failed', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('import_history', 'status_details', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('import_history', 'processing_finished_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('import_history', 'execution_finished_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('import_history', 'error_log', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Добавляем только недостающую колонку updated_at
    await queryInterface.addColumn('import_history', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true, // Временно разрешаем NULL
    });

    // Обновляем existing rows, устанавливая updated_at = created_at
    await queryInterface.sequelize.query(
      'UPDATE "import_history" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL'
    );
  },

  async down(queryInterface, Sequelize) {
    // В down оставляем как есть, чтобы можно было корректно откатить, если понадобится
    await queryInterface.removeColumn('import_history', 's3_key_processed_data');
    await queryInterface.removeColumn('import_history', 's3_key_error_data');
    await queryInterface.removeColumn('import_history', 'rows_total');
    await queryInterface.removeColumn('import_history', 'rows_processed');
    await queryInterface.removeColumn('import_history', 'rows_successfully_previewed');
    await queryInterface.removeColumn('import_history', 'rows_failed_preview');
    await queryInterface.removeColumn('import_history', 'rows_successfully_imported');
    await queryInterface.removeColumn('import_history', 'rows_failed');
    await queryInterface.removeColumn('import_history', 'status_details');
    await queryInterface.removeColumn('import_history', 'processing_finished_at');
    await queryInterface.removeColumn('import_history', 'execution_finished_at');
    await queryInterface.removeColumn('import_history', 'error_log');
    await queryInterface.removeColumn('import_history', 'updated_at');
  }
};
