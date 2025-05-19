-- Сначала удаляем старые колонки
ALTER TABLE field_mappings 
DROP COLUMN IF EXISTS client_field,
DROP COLUMN IF EXISTS system_field;

-- Добавляем новые колонки
ALTER TABLE field_mappings
ADD COLUMN IF NOT EXISTS name VARCHAR NOT NULL,
ADD COLUMN IF NOT EXISTS mapping JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Добавляем индексы
CREATE INDEX IF NOT EXISTS idx_field_mappings_name ON field_mappings (name);
CREATE INDEX IF NOT EXISTS idx_field_mappings_client_id ON field_mappings (client_id);

-- Комментарии к полям
COMMENT ON COLUMN field_mappings.name IS 'Название маппинга';
COMMENT ON COLUMN field_mappings.mapping IS 'JSON с настройками маппинга полей';
COMMENT ON COLUMN field_mappings.updated_at IS 'Дата и время последнего обновления'; 