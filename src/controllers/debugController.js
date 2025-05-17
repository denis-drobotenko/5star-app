const fs = require('fs').promises;
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/debug.log');

console.log('Debug log file path:', LOG_FILE); // Отладочная информация

// Убедимся, что директория для логов существует
async function ensureLogDirectory() {
  const logDir = path.dirname(LOG_FILE);
  console.log('Creating log directory:', logDir); // Отладочная информация
  try {
    await fs.access(logDir);
    console.log('Log directory exists');
  } catch {
    console.log('Creating log directory...');
    await fs.mkdir(logDir, { recursive: true });
  }
}

exports.writeLog = async (req, res) => {
  console.log('Received log message:', req.body); // Отладочная информация
  try {
    await ensureLogDirectory();
    
    const { message } = req.body;
    if (!message) {
      console.log('No message provided');
      return res.status(400).json({ error: 'Message is required' });
    }

    const logEntry = `[${new Date().toISOString()}] ${message}\n`;
    console.log('Writing log entry:', logEntry); // Отладочная информация
    
    await fs.appendFile(LOG_FILE, logEntry);
    console.log('Log entry written successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing to debug log:', error);
    res.status(500).json({ 
      error: 'Failed to write log',
      details: error.message,
      path: LOG_FILE
    });
  }
};

exports.getLogs = async (req, res) => {
  console.log('Getting logs...'); // Отладочная информация
  try {
    await ensureLogDirectory();
    
    const logs = await fs.readFile(LOG_FILE, 'utf8');
    console.log('Logs retrieved, size:', logs.length); // Отладочная информация
    res.json({ logs });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Log file does not exist');
      res.json({ logs: '' });
    } else {
      console.error('Error reading debug log:', error);
      res.status(500).json({ 
        error: 'Failed to read log',
        details: error.message,
        path: LOG_FILE
      });
    }
  }
}; 