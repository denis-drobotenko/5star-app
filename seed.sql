-- Пример наполнения тестовыми данными

-- Пользователи
INSERT INTO users (username, password_hash, full_name, email, role) VALUES
  ('admin', 'admin_hash', 'Администратор', 'admin@example.com', 'admin'),
  ('analyst', 'analyst_hash', 'Аналитик', 'analyst@example.com', 'analyst'),
  ('moderator', 'moderator_hash', 'Модератор', 'moderator@example.com', 'moderator');

-- Компании
INSERT INTO companies (name, inn, kpp, legal_address, actual_address, bank_details) VALUES
  ('ООО Ромашка', '1234567890', '123456789', 'Москва, ул. Ленина, 1', 'Москва, ул. Ленина, 1', 'р/с 1234567890123456');

-- Представители
INSERT INTO company_representatives (company_id, full_name, position, email, phone) VALUES
  (1, 'Иванов Иван Иванович', 'Директор', 'ivanov@company.com', '+79991234567');

-- Пример словаря и алиаса
INSERT INTO dictionaries (type, value, extra, user_id) VALUES
  ('name', 'Александр', 'male', 1);
INSERT INTO aliases (dictionary_id, alias, user_id) VALUES
  (1, 'Александер', 1);

-- Пример blocklist
INSERT INTO blocklists (company_id, user_id, phone) VALUES
  (1, 1, '+79991234567'); 