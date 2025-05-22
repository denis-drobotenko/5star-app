const sequelize = require('./sequelize.js');
const logger = require('./logger.js');
const { QueryTypes } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

let umzug = new Umzug({
  migrations: {
    glob: 'migrations/*.js',
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context, require('sequelize').Sequelize),
        down: async () => migration.down(context, require('sequelize').Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: logger,
});

let runMigrations = async () => {
  try {
    logger.info('[Migrations] Checking and running pending migrations...');
    const pendingMigrations = await umzug.pending();
    if (pendingMigrations.length > 0) {
      logger.info(`[Migrations] Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.map(m => m.name).join(', ')}`);
      await umzug.up();
      logger.info('[Migrations] All pending migrations have been executed successfully.');
    } else {
      logger.info('[Migrations] No pending migrations found. Database is up to date.');
    }
  } catch (error) {
    logger.error('[Migrations] Error running migrations:', { message: error.message, stack: error.stack });
    throw error;
  }
};

let initializeDatabase = async () => {
  try {
    logger.info('[DB Init] Attempting sequelize.authenticate()...');
    await sequelize.authenticate();
    logger.info('[DB Init] sequelize.authenticate() SUCCEEDED.');
    const initialMigrationName = '20250520075059-initial-schema.js';
    try {
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY);`,
        { type: QueryTypes.RAW }
      );
      const result = await sequelize.query(
        `SELECT "name" FROM "SequelizeMeta" WHERE "name" = :migrationName;`,
        {
          replacements: { migrationName: initialMigrationName },
          type: QueryTypes.SELECT,
        }
      );
      if (result.length === 0) {
        await sequelize.query(
          `INSERT INTO "SequelizeMeta" ("name") VALUES (:migrationName) ON CONFLICT ("name") DO NOTHING;`,
          {
            replacements: { migrationName: initialMigrationName },
            type: QueryTypes.INSERT,
          }
        );
        logger.info(`[DB Init] Initial migration '${initialMigrationName}' was not in SequelizeMeta, record added.`);
      } else {
        logger.info(`[DB Init] Initial migration '${initialMigrationName}' already recorded in SequelizeMeta.`);
      }
    } catch (metaError) {
      logger.error(`[DB Init] Error during SequelizeMeta check/setup for initial migration: ${metaError.message}`, { error: metaError });
    }
    if (process.env.NODE_ENV !== 'production') {
      await runMigrations();
    } else {
      logger.info('[DB Init] Migrations are not run automatically in production. Please run them manually if needed.');
      const pending = await umzug.pending();
      if (pending.length > 0) {
        logger.warn(`[DB Init] THERE ARE ${pending.length} PENDING MIGRATIONS! Run them manually: ${pending.map(m => m.name).join(', ')}`);
      }
    }
  } catch (error) {
    logger.error(`[DB Init] Error during database initialization or migration: ${error.message}`, { error });
    throw error;
  }
};

module.exports = { initializeDatabase, runMigrations, umzug }; 