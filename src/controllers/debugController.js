const fs = require('fs').promises;
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/debug.log');

// Убедимся, что директория для логов существует
async function ensureLogDirectory() {
  const logDir = path.dirname(LOG_FILE);
  try {
    await fs.access(logDir);
  } catch {
    await fs.mkdir(logDir, { recursive: true });
  }
}

exports.writeLog = async (req, res) => {
  try {
    await ensureLogDirectory();
    
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const logEntry = `[${new Date().toISOString()}] ${message}\n`;
    
    await fs.appendFile(LOG_FILE, logEntry);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to write log',
      details: error.message,
      path: LOG_FILE
    });
  }
};

exports.getLogs = async (req, res) => {
  try {
    await ensureLogDirectory();
    
    const logs = await fs.readFile(LOG_FILE, 'utf8');
    res.json({ logs });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ logs: '' });
    } else {
      res.status(500).json({ 
        error: 'Failed to read log',
        details: error.message,
        path: LOG_FILE
      });
    }
  }
}; 