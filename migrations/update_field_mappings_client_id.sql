-- Удаляем старый внешний ключ
ALTER TABLE field_mappings 
DROP CONSTRAINT IF EXISTS field_mappings_company_id_fkey;

-- Удаляем старый индекс
DROP INDEX IF EXISTS idx_field_mappings_company_id;

-- Переименовываем колонку
ALTER TABLE field_mappings 
RENAME COLUMN company_id TO client_id;

-- Добавляем новый внешний ключ
ALTER TABLE field_mappings
ADD CONSTRAINT field_mappings_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id);

-- Создаем новый индекс
CREATE INDEX idx_field_mappings_client_id ON field_mappings(client_id);

-- Комментарий к полю
COMMENT ON COLUMN field_mappings.client_id IS 'ID клиента'; 