import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const logsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../logs');
const logFilePath = path.join(logsDir, 'app.log');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Определяем уровень логирования из переменной окружения или по умолчанию 'info'
const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
const logLevel = process.env.LOG_LEVEL && validLogLevels.includes(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : 'info';

// Создаем логгер
let logger;
try {
  logger = winston.createLogger({
    level: logLevel, // Используем определенный уровень логирования
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }), // Логируем стек ошибок
      winston.format.splat(), // Для форматирования типа logger.info('Сообщение %s', 'значение')
      winston.format.json() // Основной формат - JSON для лучшей обработки логов
    ),
    transports: [
      /* // Временно отключаем консольный транспорт для диагностики EPIPE
      new winston.transports.Console({
        level: logLevel, // Уровень для консоли также берем из переменной
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}${info.stack ? '\n' + info.stack : ''}`)
        )
      }),
      */
      // Заменяем стандартный File транспорт на DailyRotateFile
      new winston.transports.DailyRotateFile({
        filename: path.join(logsDir, 'app-%DATE%.log'), // Шаблон имени файла
        datePattern: 'YYYY-MM-DD', // Паттерн даты для имени файла
        zippedArchive: true, // Сжимать старые логи
        maxSize: '20m', // Максимальный размер файла (например, 20MB)
        maxFiles: '14d', // Хранить логи за последние 14 дней
        level: logLevel, 
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        )
      })
    ],
    exitOnError: false
  });
  // logger.info('[logger.js] Winston logger initialized and test message sent to file.'); 
} catch (e) {
  console.error('[logger.js] CRITICAL ERROR during Winston logger creation:', e); 
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
  // console.error('[process.on] ', logMessage, details); // Дублируем в консоль
  logger.error(logMessage, details);
});

process.on('uncaughtException', (error) => {
  const logMessage = 'Uncaught Exception';
  const details = { 
    error_message: error instanceof Error ? error.message : 'N/A',
    error_stack: error instanceof Error ? error.stack : 'N/A',
    error_name: error instanceof Error ? error.name : 'N/A',
    error_details: typeof error === 'object' && error !== null ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)
  };
  // Попытка записать критическую ошибку напрямую в stderr перед выходом
  const simplifiedError = `${new Date().toISOString()} [CRITICAL_ERROR_FALLBACK] ${logMessage}: ${details.error_message}\nStack: ${details.error_stack}\n`;
  try {
    process.stderr.write(simplifiedError);
  } catch (e) {
    // Если даже это не сработало, ничего не поделаешь
  }

  // console.error('[process.on] ', logMessage, details); // Дублируем в консоль
  logger.error(logMessage, details); // По-прежнему пытаемся логировать через Winston
  process.exit(1); // Обязательно завершаем процесс
});

export default logger; 