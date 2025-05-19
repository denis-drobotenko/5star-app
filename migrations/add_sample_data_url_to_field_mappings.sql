-- Добавляем поле sample_data_url в таблицу field_mappings
ALTER TABLE field_mappings
ADD COLUMN sample_data_url TEXT;

-- Добавляем индекс для поля sample_data_url
CREATE INDEX idx_field_mappings_sample_data_url ON field_mappings (sample_data_url);

-- Комментарий к полю
COMMENT ON COLUMN field_mappings.sample_data_url IS 'URL файла с примером данных в S3'; 