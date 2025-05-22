import 'dotenv/config';
import express from 'express';
import path from 'path';
import logger from './config/logger.js';
import cors from 'cors';
import { sequelize, initializeDatabase } from '../shared/models/index.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import companiesRoutes from './routes/companies.js';
import xlsxRoutes from './routes/xlsxRoutes.js';
import fieldMappingsRoutes from './routes/fieldMappings.js';
import clientRoutes from './routes/clientRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import importRoutes from './routes/importRoutes.js';
const app = express();
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use((_req, _res, next) => {
    next();
});
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/xlsx', xlsxRoutes);
app.use('/api/field-mappings', fieldMappingsRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/imports', importRoutes);
app.use('/docs', express.static(path.join(path.dirname(new URL(import.meta.url).pathname), '../docs')));
const errorHandler = (err, req, res, next) => {
    logger.error(`[App.js - GlobalErrorHandler] UNHANDLED EXPRESS ERROR: ${err.message}`, {
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            ...(err.errors && { validationErrors: err.errors })
        },
        request: {
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            headers: req.headers,
            body: req.body
        }
    });
    const status = typeof err.status === 'number' ? err.status : 500;
    if (res.headersSent) {
        logger.error('[App.js - GlobalErrorHandler] Headers already sent, calling next(err).');
        return next(err);
    }
    res.status(status).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        ...(err.errors && { errors: err.errors })
    });
};
app.use(errorHandler);
sequelize.authenticate()
    .then(() => {
    return Promise.resolve();
})
    .then(() => {
    return initializeDatabase();
})
    .then(() => {
    logger.info('[App.js] Database initialization and migrations (if any) process completed.');
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
        logger.info(`[App.js] SERVER SUCCESSFULLY STARTED and listening on port ${PORT}.`);
    });
    server.on('error', (error, _req, _res) => {
        if (error.syscall !== 'listen') {
            throw error;
        }
        if (error.code === 'EADDRINUSE') {
            logger.error(`[App.js - server.on('error')] EADDRINUSE: Port ${PORT} is already in use. This was caught by the server's error event.`);
        }
        else {
            logger.error(`[App.js - server.on('error')] Server error: ${error.message}`, { error: error });
        }
    });
})
    .catch((err) => {
    logger.error(`[App.js] CRITICAL ERROR during database/model setup or server start: ${err.message}`, {
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            ...(err.original && { originalError: err.original })
        }
    });
    process.exit(1);
});
if (process.env.NODE_ENV === 'production') {
    logger.info('[App.js] Configuring frontend static serving for PRODUCTION.');
    app.use('/', express.static(path.join(__dirname, 'frontend/dist')));
    app.get('/*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
            logger.info(`[App.js - SPA Fallback] Serving index.html for PRODUCTION path: ${req.path}`);
        }
        res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
    });
}
else {
    logger.info('[App.js] Skipping frontend static serving and SPA fallback for DEVELOPMENT.');
    app.get('/', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/docs')) {
            res.send('Backend is running in development mode. Frontend is served by Vite dev server.');
        }
        else {
        }
    });
}
export default app;
