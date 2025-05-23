# 5star-app

## Описание

Веб-приложение для управления клиентскими данными, их очистки и формирования целевых списков для рассылок.

- Техническое задание: см. [PROJECT.md](./PROJECT.md)
- Документация по функциям: см. [docs/AI_FUNCTIONS.md](./docs/AI_FUNCTIONS.md)

---

## Быстрый старт для разработки

1. Клонируйте репозиторий:
   ```
   git clone https://github.com/denis-drobotenko/5star-app.git
   cd 5star-app
   ```
2. Установите зависимости:
   ```
   npm install
   ```
3. Создайте файл `.env` на основе `.env.example` и укажите параметры подключения к облачной базе данных.
4. Запустите сервер в режиме разработки с hot-reload:
   ```
   npm run dev
   ```
5. Сервер будет доступен на порту 3000.

---

## Запуск в Docker

1. Убедитесь, что у вас установлен Docker и docker compose.
2. Создайте файл `.env` с параметрами подключения к облачной базе.
3. Запустите:
   ```
   docker compose up --build
   ```
4. Приложение будет доступно на порту 3000.

---

## Структура проекта

- `src/` — исходный код (Node.js backend)
- `docs/` — автогенерируемая документация и описание структуры БД
- `PROJECT.md` — техническое задание
- `README.md` — краткая инструкция и описание
- `Dockerfile`, `docker-compose.yml` — для деплоя и теста

---

## Контакты

- Автор: Денис Дроботенко
- GitHub: [denis-drobotenko](https://github.com/denis-drobotenko)

# Структура приложения

- `src/` — исходный код (React, Node.js)
- `docs/` — автогенерируемая документация
- `README.md` — основная информация

# Инструменты разработки

- React
- Node.js
- PostgreSQL
- JSDoc (или TypeDoc для TypeScript) — генерация документации по коду
- dbdocs/dbdiagram.io — описание структуры БД

# Документация

Документация по функциям и структурам данных генерируется автоматически с помощью JSDoc (или TypeDoc). Описание структуры БД — вручную или с помощью dbdocs.

## Как обновлять документацию

1. Запусти команду `npm run docs` для генерации/обновления документации.
2. Документация появится в папке `docs/`.
3. Перед добавлением нового кода или функций всегда смотри в актуальную документацию!

## Правила

- Всегда обновляй документацию после изменений в коде.
- Перед написанием нового кода проверяй, нет ли уже нужной функции или структуры.
- Документация должна быть актуальной и понятной.

## Документация по структуре БД

- Структура базы данных описывается в файле `docs/db.dbml` в формате [dbml](https://www.dbml.org/home/).
- При изменениях в структуре БД обязательно обновляй этот файл.
- Для визуализации и генерации документации можно использовать [dbdocs.io](https://dbdocs.io/) или [dbdiagram.io](https://dbdiagram.io/).
- Я всегда буду использовать этот файл для анализа структуры БД и генерации кода, связанного с базой данных.

## Автоматическое обновление структуры БД

- Для автоматического обновления файла `docs/db.dbml` используется связка pg_dump и dbml-cli.
- Перед запуском укажи переменные окружения: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE.
- Запусти команду:
  ```bash
  npm run db:schema
  ```
- В результате будут обновлены файлы `docs/schema.sql` (дамп схемы) и `docs/db.dbml` (структура в dbml). 