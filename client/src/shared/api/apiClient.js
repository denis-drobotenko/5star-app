import axios from 'axios';

// Определяем API_BASE_URL. VITE_API_URL берется из .env.development или .env.production
// Эти файлы должны быть в корне frontend директории (src/frontend/.env.development)
// Fallback на localhost:5000, если не определено (порт бэкенда по умолчанию)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Логируем конфигурацию API
console.log('[API Service] Initialized with baseURL:', API_BASE_URL);

// Перехватчик для добавления токена в каждый запрос
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  console.log('[API Service] Making request:', {
    url: config.url,
    method: config.method,
    hasToken: !!token
  });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  console.error('[API Service] Request error:', error);
  return Promise.reject(error);
});

// Перехватчик ответов для стандартизации обработки ошибок и данных
apiClient.interceptors.response.use(
  response => {
    console.log('[API Service] Response received:', {
      url: response.config.url,
      status: response.status,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not array'
    });
    return response.data;
  },
  error => {
    // Обработка ошибок Axios и ошибок API
    if (error.response) {
      // Запрос был сделан, и сервер ответил кодом состояния, который выходит за пределы 2xx
      console.error('API Error Response:', error.response.data);
      // Возвращаем стандартизированный объект ошибки, чтобы его можно было обработать в компонентах
      return Promise.reject(error.response.data || { message: 'Произошла ошибка API' });
    } else if (error.request) {
      // Запрос был сделан, но ответ не был получен
      // Ошибка в настройке запроса
      // console.error('API Error Request:', error.request);
      message.error('Ошибка сети или сервер недоступен. Пожалуйста, проверьте ваше соединение.');
      return Promise.reject({ message: 'Сервер не отвечает. Проверьте сетевое соединение.' });
    } else {
      // Другая ошибка
      // console.error('Error', error.message);
      message.error(error.message || 'Произошла неизвестная ошибка при выполнении запроса.');
      return Promise.reject({ message: error.message });
    }
  }
);

export default {
  getImports: (params) => apiClient.get('/api/imports', { params }),
  // Заменяем Companies на Clients
  getClients: () => apiClient.get('/api/clients'), 
  // getFieldMappings должен принимать clientId для фильтрации
  getFieldMappings: (clientId) => apiClient.get('/api/field-mappings', { params: { clientId } }), 
  initiateImport: (data) => apiClient.post('/api/imports/initiate', data),
  uploadFile: (importId, file) => {
    const formData = new FormData();
    formData.append('importFile', file); // 'importFile' - имя поля, ожидаемое multer на бэкенде
    return apiClient.post(`/api/imports/${importId}/upload-file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
  },
  executeImport: (importId) => apiClient.post(`/api/imports/${importId}/execute`),
  // ... другие ваши API вызовы

  // Функция для получения подписанной ссылки на файл из S3
  getSignedUrlForFile: (s3Key) => {
    return apiClient.get('/api/field-mappings/s3-signed-url', { params: { key: s3Key } });
  }
}; 