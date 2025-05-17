const winston = require('winston');
const path = require('path');

// НЕПОСРЕДСТВЕННАЯ ПРОВЕРКА ЗАПУСКА ФАЙЛА ЛОГГЕРА
// console.log('[logger.js] Script execution STARTED.'); 

// Определяем путь к файлу логов
const logFilePath = path.join(__dirname, '../../logs/app.log');
// console.log(`[logger.js] Log file path determined as: ${logFilePath}`);

// Создаем логгер
let logger;
try {
  logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
    ),
    transports: [
      // Вывод в консоль (оставляем как есть, или можно тоже debug)
      new winston.transports.Console({
        level: 'debug', // Также для консоли, чтобы видеть debug сообщения и там
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
        )
      }),
      // Запись в файл
      new winston.transports.File({ 
        filename: logFilePath,
        level: 'debug' // Изменено на debug
      })
    ],
    exitOnError: false
  });
  // console.log('[logger.js] Winston logger created successfully.');
  // logger.info('[logger.js] Winston logger initialized and test message sent to file.'); 
  // logger.debug('[logger.js] Debug level logging is now enabled.'); 
} catch (e) {
  console.error('[logger.js] CRITICAL ERROR during Winston logger creation:', e); // Лог в консоль
  // Создаем заглушку для logger, чтобы приложение не упало при попытке его использовать
  logger = {
    info: (msg, meta) => console.info('[DummyLogger-INFO]', msg, meta || ''),
    warn: (msg, meta) => console.warn('[DummyLogger-WARN]', msg, meta || ''),
    error: (msg, meta) => console.error('[DummyLogger-ERROR]', msg, meta || ''),
  };
}

// Направляем неперехваченные исключения и отклоненные промисы в основной логгер
process.on('unhandledRejection', (reason, promise) => {
  const logMessage = 'Unhandled Rejection';
  const details = { 
    reason_message: reason instanceof Error ? reason.message : JSON.stringify(reason),
    reason_stack: reason instanceof Error ? reason.stack : undefined,
    promise_object: JSON.stringify(promise)
  };
  console.error('[process.on] ', logMessage, details); // Дублируем в консоль
  logger.error(logMessage, details);
});

process.on('uncaughtException', (error) => {
  const logMessage = 'Uncaught Exception';
  const details = { 
    error_message: error instanceof Error ? error.message : 'N/A',
    error_stack: error instanceof Error ? error.stack : 'N/A',
    error_name: error instanceof Error ? error.name : 'N/A',
    error_details: JSON.stringify(error, Object.getOwnPropertyNames(error))
  };
  console.error('[process.on] ', logMessage, details); // Дублируем в консоль
  logger.error(logMessage, details);
  // process.exit(1); 
});

module.exports = logger; 