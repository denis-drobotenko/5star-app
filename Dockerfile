# Используем официальный образ Node.js LTS
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем исходный код
COPY . .

# Открываем порт (по умолчанию 3000)
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 