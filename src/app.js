const express = require('express');
const path = require('path');
const logger = require('./config/logger');

// logger.info('[App.js] Script execution STARTED.');

// logger.info('[App.js] Requiring ./models...');
const { sequelize, syncModels } = require('./models');
// logger.info('[App.js] ./models REQUIRED.');

// logger.info('[App.js] Requiring dotenv...');
require('dotenv').config();
// logger.info('[App.js] dotenv REQUIRED and configured.');

// logger.info('[App.js] Requiring cors...');
const cors = require('cors');
// logger.info('[App.js] cors REQUIRED.');

// logger.info('[App.js] Requiring ./routes/auth...');
const authRoutes = require('./routes/auth');
// logger.info('[App.js] ./routes/auth REQUIRED.');

// logger.info('[App.js] Requiring ./routes/users...');
const usersRoutes = require('./routes/users');
// logger.info('[App.js] ./routes/users REQUIRED.');

// logger.info('[App.js] Requiring ./routes/companies...');
const companiesRoutes = require('./routes/companies');
// logger.info('[App.js] ./routes/companies REQUIRED.');

// logger.info('[App.js] Requiring ./routes/xlsxRoutes...');
const xlsxRoutes = require('./routes/xlsxRoutes');
// logger.info('[App.js] ./routes/xlsxRoutes REQUIRED.');

// logger.info('[App.js] Requiring ./routes/fieldMappings...');
const fieldMappingsRoutes = require('./routes/fieldMappings');
// logger.info('[App.js] ./routes/fieldMappings REQUIRED.');

// logger.info('[App.js] Requiring ./routes/clientRoutes...');
const clientRoutes = require('./routes/clientRoutes');
// logger.info('[App.js] ./routes/clientRoutes REQUIRED.');

// logger.info('[App.js] Requiring ./routes/debugRoutes...');
const debugRoutes = require('./routes/debugRoutes');
// logger.info('[App.js] ./routes/debugRoutes REQUIRED.');

// logger.info('[App.js] All modules imported (after individual require logs).');

const app = express();

// logger.info('[App.js] Express app created.');

// Включаем CORS для всех запросов (можно настроить более детально)
// logger.info('[App.js] Attempting to use CORS middleware...');
app.use(cors());
// logger.info('[App.js] CORS middleware configured.');

// Middleware для логирования запросов (пример)
// logger.info('[App.js] Attempting to use request logging middleware...');
app.use((req, res, next) => {
  logger.info(`[App.js - RequestLogger] INCOMING: ${req.method} ${req.url} from ${req.ip}`);
  // logger.info(`[App.js - RequestLogger] Headers: ${JSON.stringify(req.headers)}`); // Закомментировано, т.к. может быть слишком многословно
  next();
});
// logger.info('[App.js] Request logging middleware configured.');

// Увеличиваем лимиты для больших файлов
// logger.info('[App.js] Attempting to use express.json middleware...');
app.use(express.json({ limit: '20mb' }));
// logger.info('[App.js] express.json middleware configured.');

// logger.info('[App.js] Attempting to use express.urlencoded middleware...');
app.use(express.urlencoded({ limit: '20mb', extended: true }));
// logger.info('[App.js] express.urlencoded middleware configured.');

// API маршруты
// logger.info('[App.js] Configuring API routes...');
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/xlsx', xlsxRoutes);
app.use('/api/field-mappings', fieldMappingsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api', debugRoutes);
// logger.info('[App.js] API routes configured.');

// Делаем документацию JSDoc доступной по /docs
// logger.info('[App.js] Configuring JSDoc static serving...');
app.use('/docs', express.static(path.join(__dirname, '../docs')));
// logger.info('[App.js] JSDoc static serving configured.');

// Раздача статических файлов фронтенда
// logger.info('[App.js] Configuring frontend static serving...');
app.use('/', express.static(path.join(__dirname, 'frontend/dist')));
// logger.info('[App.js] Frontend static serving configured.');

// Глобальный обработчик ошибок Express
// logger.info('[App.js] Configuring global error handler...');
app.use((err, req, res, next) => {
  logger.error(`[App.js - GlobalErrorHandler] UNHANDLED EXPRESS ERROR: ${err.message}`,
    {
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
        ...(err.errors && { validationErrors: err.errors }) // Для ошибок валидации Sequelize
      },
      request: {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        headers: req.headers,
        body: req.body // Осторожно с большими телами запросов
      }
    }
  );
  if (res.headersSent) {
    logger.error('[App.js - GlobalErrorHandler] Headers already sent, calling next(err).');
    return next(err);
  }
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
// logger.info('[App.js] Global error handler configured.');

// Проверка подключения к БД и синхронизация моделей при запуске
// logger.info('[App.js] Starting database authentication and model synchronization...');
sequelize.authenticate()
  .then(() => {
    // logger.info('[App.js] Database authentication SUCCESSFUL.');
    // logger.info('[App.js] Attempting to sync models...');
    return syncModels();
  })
  .then(() => {
    // logger.info('[App.js] Model synchronization SUCCESSFUL.');
    const PORT = process.env.PORT || 3000;
    // logger.info(`[App.js] Preparing to start server on port ${PORT}.`);
    
    const server = app.listen(PORT, () => {
      logger.info(`[App.js] SERVER SUCCESSFULLY STARTED and listening on port ${PORT}.`);
    });

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.error(`[App.js - server.on('error')] EADDRINUSE: Port ${PORT} is already in use. This was caught by the server's error event.`);
      } else {
        logger.error(`[App.js - server.on('error')] Server error: ${e.message}`, { error: e });
      }
    });

    // logger.info(`[App.js] app.listen called for port ${PORT}. Waiting for server to start or error.`); // Этот лог дублирует информацию или может быть запутывающим

  })
  .catch(err => {
    logger.error(`[App.js] CRITICAL ERROR during database/model setup or server start: ${err.message}`,
      {
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
          ...(err.original && { originalError: err.original }) // Для ошибок Sequelize
        }
      }
    );
    process.exit(1);
  });

// logger.info('[App.js] End of script execution flow reached (server start is async).');

/**
 * Проверка работоспособности JSDoc.
 * @returns {string}
 */
function testDoc() {
  return 'JSDoc работает!';
}

// Маршрут по умолчанию для SPA (должен быть последним!)
app.get('/*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
    // logger.info(`[App.js - SPA Fallback] Serving index.html for path: ${req.path}`); // Можно оставить для отладки SPA роутинга, но по умолчанию лучше убрать
  }
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});
