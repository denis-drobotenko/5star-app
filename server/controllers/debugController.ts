import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_FILE = path.join(__dirname, '../../logs/debug.log');

// Убедимся, что директория для логов существует
async function ensureLogDirectory(): Promise<void> {
  const logDir = path.dirname(LOG_FILE);
  try {
    await fs.access(logDir);
  } catch {
    await fs.mkdir(logDir, { recursive: true });
  }
}

async function writeLog(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    await ensureLogDirectory();
    
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const logEntry = `[${new Date().toISOString()}] ${message}\n`;
    
    await fs.appendFile(LOG_FILE, logEntry);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to write log',
      details: error.message,
      path: LOG_FILE
    });
    // _next(error); // Если нужно передать ошибку дальше
  }
}

async function getLogs(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    await ensureLogDirectory();
    
    const logs = await fs.readFile(LOG_FILE, 'utf8');
    res.json({ logs });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.json({ logs: '' });
      return;
    } else {
      res.status(500).json({ 
        error: 'Failed to read log',
        details: error.message,
        path: LOG_FILE
      });
      // _next(error); // Если нужно передать ошибку дальше
    }
  }
}

// Добавляем простой ping эндпоинт
async function ping(_req: Request, res: Response): Promise<void> {
  res.status(200).send('pong');
}

export {
  writeLog,
  getLogs,
  ping
}; 