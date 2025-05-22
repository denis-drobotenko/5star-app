'use strict';

// const logger = require('../src/config/logger'); // Раскомментировать и настроить путь, если нужен winston логгер

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Установить user_type = 'INTERNAL' для пользователей, где user_type IS NULL
      const [userTypeResults, userTypeMeta] = await queryInterface.bulkUpdate('users', 
        { user_type: 'INTERNAL' },
        { user_type: { [Sequelize.Op.is]: null } },
        { transaction }
      );
      // В sequelize v6+ bulkUpdate возвращает количество затронутых строк напрямую (если диалект поддерживает)
      // userTypeMeta может быть undefined или содержать rowCount в зависимости от диалекта/версии.
      // Для PostgreSQL обычно возвращается количество строк.
      const userTypeRowCount = Array.isArray(userTypeResults) ? userTypeResults.length : (userTypeMeta ? userTypeMeta.rowCount : 'unknown');
      console.log(`[DataMigration] 'user_type' update attempted. Affected rows: ${userTypeRowCount}`);
      // if (logger) logger.info(`[DataMigration] 'user_type' update attempted. Affected rows: ${userTypeRowCount}`);

      // 2. Установить created_at = NOW() для пользователей, где created_at IS NULL
      const [createdAtResults, createdAtMeta] = await queryInterface.bulkUpdate('users',
        { created_at: Sequelize.fn('NOW') },
        { created_at: { [Sequelize.Op.is]: null } },
        { transaction }
      );
      const createdAtRowCount = Array.isArray(createdAtResults) ? createdAtResults.length : (createdAtMeta ? createdAtMeta.rowCount : 'unknown');
      console.log(`[DataMigration] 'created_at' update attempted. Affected rows: ${createdAtRowCount}`);
      // if (logger) logger.info(`[DataMigration] 'created_at' update attempted. Affected rows: ${createdAtRowCount}`);

      // 3. Установить updated_at = NOW() для пользователей, где updated_at IS NULL
      const [updatedAtResults, updatedAtMeta] = await queryInterface.bulkUpdate('users',
        { updated_at: Sequelize.fn('NOW') },
        { updated_at: { [Sequelize.Op.is]: null } },
        { transaction }
      );
      const updatedAtRowCount = Array.isArray(updatedAtResults) ? updatedAtResults.length : (updatedAtMeta ? updatedAtMeta.rowCount : 'unknown');
      console.log(`[DataMigration] 'updated_at' update attempted. Affected rows: ${updatedAtRowCount}`);
      // if (logger) logger.info(`[DataMigration] 'updated_at' update attempted. Affected rows: ${updatedAtRowCount}`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('[DataMigration] Error during data update for existing users:', error);
      // if (logger) logger.error('[DataMigration] Error during data update for existing users:', { error });
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    console.log('[DataMigration] Down migration for data-update-existing-users is not implemented (data changes are usually not reverted).');
    // if (logger) logger.info('[DataMigration] Down migration for data-update-existing-users is not implemented.');
    return Promise.resolve();
  }
};
