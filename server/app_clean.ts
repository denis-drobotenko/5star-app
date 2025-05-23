// ????????? ?????????? ????????? ???????
require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./config/logger');
const cors = require('cors');
import type { Request, Response, NextFunction } from 'express';

// const { sequelize, syncModels } = require('./models'); // ?????? ??????
const { sequelize, initializeDatabase } = require('../shared/models'); // ????? ??????

// logger.info('[App.js] Script execution STARTED.');

// logger.info('[App.js] Requiring ./models...');
// const { sequelize, syncModels } = require('./models'); // ???????? ????????? ??? ????????? ? ??
// logger.info('[App.js] ./models REQUIRED.');

// logger.info('[App.js] Requiring cors...');
// logger.info('[App.js] cors REQUIRED.');

// ???????? ????????? ??????? ? ????????????? ???? ??????
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

const importRoutes = require('./routes/importRoutes');

// logger.info('[App.js] All modules imported (after individual require logs).');

const app = express();

// logger.info('[App.js] Express app created.');

// ????? CORS
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'], // ????????? ??? ???????? ? ?????? (???? ?? ????????????)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // ??????????? ??????
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // ??????????? ?????????
  credentials: true, // ????????? ???????? credentials (????????, cookies, Authorization header)
  optionsSuccessStatus: 204 // ??? ?????? ?????????, ??????? ????? ????? ???????? ? ????? 204
};

// ???? ???????????? OPTIONS ??????? ??? ???? ?????????
app.options('*', cors(corsOptions));

// ????????? CORS ?? ???? ????????? ????????
app.use(cors(corsOptions));

// Middleware ??? ??????????? ???? ????????
app.use((_req: Request, _res: Response, next: NextFunction) => {
  // logger.info(`[App.js - RequestLogger] INCOMING: ${req.method} ${req.url} from ${req.ip}`); // ???????????????? ??? ?????????? ?????????? ?????
  // logger.info(`[App.js - RequestLogger] Headers: ${JSON.stringify(req.headers)}`); // ????????????????, ?.?. ????? ???? ??????? ???????????
  next();
});

// ??????????? ?????? ??? ??????? ??????
// logger.info('[App.js] Attempting to use express.json middleware...');
app.use(express.json({ limit: '20mb' }));
// logger.info('[App.js] express.json middleware configured.');

// logger.info('[App.js] Attempting to use express.urlencoded middleware...');
app.use(express.urlencoded({ limit: '20mb', extended: true }));
// logger.info('[App.js] express.urlencoded middleware configured.');

// API ????????
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/xlsx', xlsxRoutes);
app.use('/api/field-mappings', fieldMappingsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/imports', importRoutes);

// ?????? ???????????? JSDoc ????????? ?? /docs
// logger.info('[App.js] Configuring JSDoc static serving...');
app.use('/docs', express.static(path.join(__dirname, '../docs')));
// logger.info('[App.js] JSDoc static serving configured.');

// ??????? ??????????? ?????? ?????????
// logger.info('[App.js] Configuring frontend static serving...');
// app.use('/', express.static(path.join(__dirname, 'frontend/dist'))); // ????????????????
// logger.info('[App.js] Frontend static serving configured.');

// ?????????? ?????????? ?????? Express
// logger.info('[App.js] Configuring global error handler...');
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[App.js - GlobalErrorHandler] UNHANDLED EXPRESS ERROR: ${err.message}`,
    {
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
        ...(err.errors && { validationErrors: err.errors }) // ??? ?????? ????????? Sequelize
      },
      request: {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        headers: req.headers,
        body: req.body // ????????? ? ???????? ?????? ????????
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

// ???????? ??????????? ? ??, ?????? ???????? ? ????????????? ??????? ??? ??????? - ?????????????????
// logger.info('[App.js] Starting database authentication and model synchronization...');
sequelize.authenticate()
  .then(() => {
    // logger.info('[App.js] Database authentication SUCCESSFUL.');
    // ??????? ????????? ????????
    // ???????? ????????? ??? ???????????? ?????? ????? sync({force:true})
    // return migrationManager.runMigrations(); 
    return Promise.resolve(); // ?????????? resolved Promise, ????? ??????? .then() ????????????
  })
  .then(() => {
    // ????? ????????? ?????????? ???????? ?????????????? ??????
    // logger.info('[App.js] Attempting to sync models...');
    return initializeDatabase();
  })
  .then(() => {
    // logger.info('[App.js] Model synchronization SUCCESSFUL.');
    logger.info('[App.js] Database initialization and migrations (if any) process completed.');
    const PORT = process.env.PORT || 3000;
    // logger.info(`[App.js] Preparing to start server on port ${PORT}.`);
    
    const server = app.listen(PORT, () => {
      logger.info(`[App.js] SERVER SUCCESSFULLY STARTED and listening on port ${PORT}.`);
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        logger.error(`[App.js - server.on('error')] EADDRINUSE: Port ${PORT} is already in use. This was caught by the server's error event.`);
      } else {
        logger.error(`[App.js - server.on('error')] Server error: ${e.message}`, { error: e });
      }
    });

  })
  .catch((err: any) => {
    logger.error(`[App.js] CRITICAL ERROR during database/model setup or server start: ${err.message}`,
      {
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
          ...(err.original && { originalError: err.original }) // ??? ?????? Sequelize
        }
      }
    );
    process.exit(1);
  });

// ???????? app.listen - ?????? ???????????????
/*
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`[App.js] SERVER STARTED (DB & Routes SKIPPED) and listening on port ${PORT}.`);
});
*/

// logger.info('[App.js] End of script execution flow reached (server start is async).');

/**
 * ???????? ????????????????? JSDoc.
 * @returns {string}
 */
// function testDoc() {
//   return 'JSDoc is working';
// }

// ??????? ?? ????????? ??? SPA (?????? ???? ?????????!)
// app.get('/*', (req, res) => { // ????????????????
//   if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
//     // logger.info(`[App.js - SPA Fallback] Serving index.html for path: ${req.path}`); // ????? ???????? ??? ??????? SPA ????????, ?? ?? ????????? ????? ??????
//   }
//   res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
// });

if (process.env.NODE_ENV === 'production') {
  // ??????? ??????????? ?????? ????????? ??? production
  logger.info('[App.js] Configuring frontend static serving for PRODUCTION.');
  app.use('/', express.static(path.join(__dirname, 'frontend/dist')));

  // ??????? ?? ????????? ??? SPA ??? production (?????? ???? ?????????!)
app.get('/*', (req: any, res: any) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
      // logger.info(`[App.js - SPA Fallback] Serving index.html for PRODUCTION path: ${req.path}`);
  }
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});
} else {
  logger.info('[App.js] Skipping frontend static serving and SPA fallback for DEVELOPMENT.');
  // ? ?????? ?????????? Vite ??? ??????????? ????????.
  // ????? ???????? ??????? ????? ??? ????????? ????, ???? ?????.
  app.get('/', (req: any, res: any) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
      res.send('Backend is running in development mode. Frontend is served by Vite dev server.');
    } else {
      // This case should ideally not be hit if API routes are defined before this generic handler.
      // However, if an API-like path is not handled by specific routes,
      // Express would try to match it here.
      // We are in development, and non-API/auth/docs routes are handled by Vite.
      // So for any other unhandled path that might look like an API call but isn't,
      // we can send a 404 or a specific message.
      // For simplicity, let's assume all API routes are correctly defined above.
      // If a request like /api/nonexistent is made, it should be handled by API router or result in 404 from there.
      // This part ensures that if a request somehow bypasses API routers and is not SPA route,
      // it doesn't accidentally try to serve index.html or show a generic message for an API path.
      // However, the `if` condition already filters for non-API paths.
      // So, for this `else` branch, we simply let it pass to be handled by subsequent error handlers or 404.
      // A better approach might be to ensure all API routes return a 404 if not found,
      // and this generic handler is only for SPA/static assets.
      // Given the current structure, if it's an API path, it should have been handled.
      // If we reach here with an API path, it's an issue with routing order or definition.
      // For now, this 'else' might be redundant due to the outer 'if'.
      // No specific action needed here, Express will 404 if no other middleware handles it.
    }
  });
}

module.exports = app;
