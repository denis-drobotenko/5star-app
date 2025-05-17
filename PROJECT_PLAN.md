# Рабочий план реализации требований ТЗ

## 1. Пользователи и роли
- [x] CRUD для пользователей (создание, редактирование, удаление, получение по id и списком)
- [x] Интерфейс для управления пользователями (frontend)
- [x] Авторизация (login, register)
- [x] Интерфейс для авторизации (frontend)
- [x] Роли пользователей (admin, analyst, moderator)

## 2. Компании и представители
- [x] CRUD для компаний-клиентов
- [x] Интерфейс для управления компаниями (frontend)
- [x] CRUD для представителей компаний
- [x] Интерфейс для управления представителями компаний (frontend)

## 3. Сопоставление полей (маппинг)
- [ ] CRUD для маппинга полей (field_mappings)
- [x] Интерфейс для настройки маппинга полей (frontend)

## 4. Импорт и обработка данных о продажах
- [ ] Импорт файлов (XLSX, Google Sheets)
- [ ] Интерфейс для импорта файлов (frontend)
- [ ] История загрузок (import_history)
- [ ] Интерфейс для истории загрузок (frontend)
- [ ] Очистка и стандартизация данных
- [ ] Интерфейс для очистки/стандартизации данных (frontend)

## 5. Словари и алиасы
- [ ] CRUD для словарей корректных значений (dictionaries)
- [ ] Интерфейс для словарей (frontend)
- [ ] CRUD для алиасов (aliases)
- [ ] Интерфейс для алиасов (frontend)

## 6. Блок-листы
- [ ] CRUD для блок-листов (blocklists)
- [ ] Интерфейс для блок-листов (frontend)

## 7. Генерация и выгрузка списков для рассылок
- [ ] Генерация списков по SQL-логике
- [ ] Интерфейс для генерации списков (frontend)
- [ ] Выгрузка списков (CSV, XLSX)
- [ ] Интерфейс для выгрузки списков (frontend)

## Рефакторинг Frontend структуры

- [x] Создать базовую структуру директорий для frontend (`components`, `pages`, `layouts`, `contexts`, `constants`).
- [x] Вынести `AuthProvider` и `useAuth` в `src/frontend/src/contexts/AuthContext.jsx`.
- [x] Вынести `API_URL`, `APP_NAME` и цветовые константы в `src/frontend/src/constants/appConstants.js`.
- [x] Вынести `LoginPage` в `src/frontend/src/pages/LoginPage.jsx`.
- [x] Вынести `DashboardLayout` в `src/frontend/src/layouts/DashboardLayout.jsx`.
- [x] Вынести `DashboardHome` в `src/frontend/src/pages/DashboardHomePage.jsx`.
- [x] Вынести `CompaniesPage` (Юрлица) в `src/frontend/src/pages/CompaniesPage.jsx`.
- [x] Вынести `ClientsPage` в `src/frontend/src/pages/ClientsPage.jsx`.
- [x] Вынести `UsersPage` в `src/frontend/src/pages/UsersPage.jsx`.
- [x] Вынести `targetFieldMappings` и `requiredFields` из `FieldMappingPage` в `src/frontend/src/constants/fieldMappingConstants.js`.
- [x] Вынести `FieldMappingPage` в `src/frontend/src/pages/FieldMappingPage.jsx`.
- [x] Вынести `SettingsPage` в `src/frontend/src/pages/SettingsPage.jsx`.
- [ ] Вынести `DebugLogsButton` в `src/frontend/src/components/DebugLogsButton.jsx`.
- [x] Обновить все импорты в затронутых файлах.
- [ ] Проверить работоспособность приложения после рефакторинга.

---

> По мере реализации задач отмечать их как выполненные ([x]). 