-- Пример наполнения тестовыми данными

-- Пользователи
INSERT INTO users (username, password_hash, full_name, email, role, user_type, client_id, company_id, created_at, updated_at) VALUES
  ('admin', '$2b$10$4SluI.tlGqV7ZYD4Db3WR.kb5UFqolBXOdvhhDcBbIhsnsEdu6xxu', 'Администратор', 'admin@example.com', 'admin', 'INTERNAL', NULL, 1, NOW(), NOW()),
  ('analyst', 'analyst_hash', 'Аналитик', 'analyst@example.com', 'analyst', 'INTERNAL', NULL, NULL, NOW(), NOW()),
  ('moderator', 'moderator_hash', 'Модератор', 'moderator@example.com', 'moderator', 'INTERNAL', NULL, NULL, NOW(), NOW());

-- Компании
INSERT INTO companies (name, inn, kpp, legal_address, actual_address, bank_details, created_at, updated_at) VALUES
  ('ООО Ромашка', '1234567890', '123456789', 'Москва, ул. Ленина, 1', 'Москва, ул. Ленина, 1', 'р/с 1234567890123456', NOW(), NOW());

-- Представители (УДАЛЕНО, т.к. модель CompanyRepresentative была удалена из проекта)
-- INSERT INTO company_representatives (company_id, full_name, position, email, phone, created_at, updated_at) VALUES
--  (1, 'Иванов Иван Иванович', 'Директор', 'ivanov@company.com', '+79991234567', NOW(), NOW());

-- Пример словаря и алиаса
INSERT INTO dictionaries (type, value, extra, user_id) VALUES
  ('name', 'Александр', 'male', 1);
INSERT INTO aliases (dictionary_id, alias, user_id) VALUES
  (1, 'Александер', 1);

-- Пример blocklist
INSERT INTO blocklists (company_id, user_id, phone) VALUES
  (1, 1, '+79991234567'); 