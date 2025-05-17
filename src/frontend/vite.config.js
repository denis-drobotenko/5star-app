import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Явно указываем принимать внешние подключения
    allowedHosts: [
        '5-star-roi.ru', // Разрешаем доступ с этого хоста
    ],
    proxy: {
      // Проксируем все API запросы на бэкенд
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/companies': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/representatives': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/field-mappings': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/xlsx': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
