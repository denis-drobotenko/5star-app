const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

class MigrationManager {
  constructor() {
    // Явно указываем параметры подключения из переменных окружения
    const dbConfig = {
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    };

    logger.info('Параметры подключения к БД:', {
      database: dbConfig.database,
      user: dbConfig.user,
      host: dbConfig.host,
      port: dbConfig.port
    });

    this.pool = new Pool(dbConfig);
  }

  async init() {
    // Создаем таблицу для отслеживания миграций, если её нет
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async getAppliedMigrations() {
    const result = await this.pool.query('SELECT name FROM migrations ORDER BY applied_at ASC');
    return result.rows.map(row => row.name);
  }

  async applyMigration(migrationName, sql) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Применяем миграцию
      await client.query(sql);
      
      // Записываем информацию о миграции
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migrationName]
      );
      
      await client.query('COMMIT');
      logger.info(`Миграция ${migrationName} успешно применена`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Ошибка при применении миграции ${migrationName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations() {
    try {
      // Инициализируем таблицу миграций
      await this.init();

      // Получаем список примененных миграций
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Читаем все SQL файлы из директории migrations
      const migrationsDir = path.join(process.cwd(), 'migrations');
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));

      // Сортируем файлы по имени
      sqlFiles.sort();

      // Применяем новые миграции
      for (const file of sqlFiles) {
        if (!appliedMigrations.includes(file)) {
          logger.info(`Применяю миграцию: ${file}`);
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf-8');
          await this.applyMigration(file, sql);
        }
      }

      logger.info('Все миграции успешно применены');
    } catch (error) {
      logger.error('Ошибка при применении миграций:', error);
      throw error;
    }
  }
}

module.exports = new MigrationManager(); 