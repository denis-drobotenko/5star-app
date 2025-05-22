# Этап сборки фронтенда
FROM node:18-alpine as frontend

# Устанавливаем рабочую директорию для фронтенда
WORKDIR /usr/src/client

# Копируем package.json и package-lock.json фронтенда
COPY frontend/package*.json ./

# Устанавливаем зависимости фронтенда
RUN npm install

# Копируем исходный код фронтенда
COPY frontend/ ./

# Собираем фронтенд
RUN npm run build

# Этап разработки
FROM node:18-alpine as development

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости, включая devDependencies
RUN npm install

# Копируем собранный фронтенд
COPY --from=frontend /usr/src/client/dist ./client/dist

# Копируем исходный код
COPY . .

# Устанавливаем nodemon для автоматической перезагрузки
RUN npm install -g nodemon

# Этап продакшена
FROM node:18-alpine as production

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm install --production

# Копируем собранный фронтенд
COPY --from=frontend /usr/src/client/dist ./client/dist

# Копируем исходный код
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 