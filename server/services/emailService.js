const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// Настройка SMTP-транспорта для Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com', // SMTP-сервер
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,    // Порт (587 для TLS/STARTTLS, 465 для SSL)
  secure: (process.env.EMAIL_PORT === '465'), // true для порта 465, false для других (STARTTLS будет использован автоматически для 587)
  auth: {
    user: process.env.EMAIL_USER, // Ваш email адрес (из .env)
    pass: process.env.EMAIL_PASS  // Ваш пароль или пароль приложения (из .env)
  },
  tls: {
    // При использовании Gmail и порта 587, иногда требуется явно указать ciphers
    // Это может быть необходимо, если возникают ошибки типа "wrong version number" или "self signed certificate"
    // Если проблем нет, эту секцию можно закомментировать или удалить.
    // ciphers: 'SSLv3' // Пример, может потребоваться другая конфигурация в зависимости от сервера и ошибок
    rejectUnauthorized: process.env.NODE_ENV === 'production' // В разработке можно установить false, если есть проблемы с SSL-сертификатом
  }
});

/**
 * Отправляет email для сброса пароля.
 * @param {string} to - Email адрес получателя.
 * @param {string} token - Токен для сброса пароля (не хешированный).
 */
async function sendPasswordResetEmail(to, token) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  // Используем email из .env как отправителя по умолчанию, если он там задан, иначе предоставленный вами
  const mailFromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'drobotenko@5star-roi.com';
  const mailFromName = process.env.EMAIL_FROM_NAME || '5Star App';

  const mailOptions = {
    from: `"${mailFromName}" <${mailFromAddress}>`,
    to: to,
    subject: 'Сброс пароля для вашего аккаунта 5Star App',
    text: `Здравствуйте!\n\nВы (или кто-то другой) запросили сброс пароля для вашего аккаунта в 5Star App.\nПожалуйста, перейдите по следующей ссылке, чтобы установить новый пароль:\n${resetUrl}\n\nЕсли вы не запрашивали сброс пароля, просто проигнорируйте это письмо, и ваш пароль останется без изменений.\n\nСсылка действительна в течение 1 часа.\n\nС уважением,\nКоманда 5Star App`,
    html: `<p>Здравствуйте!</p>
           <p>Вы (или кто-то другой) запросили сброс пароля для вашего аккаунта в 5Star App.</p>
           <p>Пожалуйста, перейдите по следующей ссылке, чтобы установить новый пароль:</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо, и ваш пароль останется без изменений.</p>
           <p>Ссылка действительна в течение 1 часа.</p>
           <p>С уважением,<br>Команда 5Star App</p>`
  };

  try {
    logger.info(`[EmailService] Attempting to send password reset email to: ${to} via SMTP: ${transporter.options.host}. From: ${mailOptions.from}`);
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] Password reset email sent successfully to ${to}. Message ID: ${info.messageId}`);
    if (process.env.NODE_ENV !== 'production' && nodemailer.getTestMessageUrl(info)) {
        logger.info("[EmailService] Preview URL (if using ethereal.email): %s", nodemailer.getTestMessageUrl(info));
    }
    return info;
  } catch (error) {
    logger.error(`[EmailService] Error sending password reset email to ${to} via SMTP:`, { errorMessage: error.message, errorStack: error.stack, errorFull: JSON.stringify(error, Object.getOwnPropertyNames(error), 2) });
    // Можно рассмотреть вариант пробрасывания ошибки, чтобы API вернул специфическую ошибку, если почта критична.
  }
}

module.exports = {
  sendPasswordResetEmail
}; 