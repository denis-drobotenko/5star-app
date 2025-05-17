const AWS = require('aws-sdk');
require('dotenv').config(); // Раскомментируем на случай, если глобальной конфигурации нет или для явности

// Читаем переменные окружения
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_REGION = process.env.S3_REGION;

// Удаляем захардкоженные значения
// const S3_ENDPOINT = 'https://s3.regru.cloud';
// const S3_ACCESS_KEY_ID = 'RXT10KNXPH5UAXK6RX57'; 
// const S3_SECRET_ACCESS_KEY = 'nnhFfPhNxL7qDKFwVQZtfLeV8QfBlVf6Okej8GU2'; 
// const S3_BUCKET_NAME = '5star-bucket'; 
// const S3_REGION = 'ru-msk'; 

// Логирование для проверки (можно будет убрать позже)
// if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET_NAME || !S3_REGION) {
//   console.error('[S3 Config Error] Одна или несколько переменных S3 окружения не определены! Пожалуйста, проверьте ваш .env файл.');
//   console.error('S3_ENDPOINT:', S3_ENDPOINT ? 'OK' : 'MISSING');
//   console.error('S3_ACCESS_KEY_ID:', S3_ACCESS_KEY_ID ? 'OK' : 'MISSING');
//   console.error('S3_SECRET_ACCESS_KEY:', S3_SECRET_ACCESS_KEY ? 'OK' : 'MISSING');
//   console.error('S3_BUCKET_NAME:', S3_BUCKET_NAME ? 'OK' : 'MISSING');
//   console.error('S3_REGION:', S3_REGION ? 'OK' : 'MISSING');
// }

const s3 = new AWS.S3({
  endpoint: S3_ENDPOINT,
  accessKeyId: S3_ACCESS_KEY_ID,
  secretAccessKey: S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true, 
  signatureVersion: 'v4',
  region: S3_REGION, 
});

module.exports = { s3, S3_BUCKET_NAME }; 