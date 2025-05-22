const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const tempOutputFile = 'tmp_jsdoc_output.json'; // Имя временного файла

try {
  // 1. Выполняем jsdoc и перенаправляем вывод во временный файл
  execSync(`npx jsdoc -X src/**/*.js > ${tempOutputFile}`, { encoding: 'utf-8' });

  // 2. Читаем данные из временного файла
  if (!fs.existsSync(tempOutputFile)) {
    throw new Error(`JSDoc temporary output file not found: ${tempOutputFile}`);
  }
  const jsdocRaw = fs.readFileSync(tempOutputFile, { encoding: 'utf-8' });
  
  // 3. Удаляем временный файл
  fs.unlinkSync(tempOutputFile);

  const jsdoc = JSON.parse(jsdocRaw);

  const functions = jsdoc.filter(item => item.kind === 'function' || item.kind === 'member')
    .filter(item => item.tags && item.tags.some(t => t.title === 'route'))
    .map(item => {
      const params = item.params && item.params.length > 0
        ? item.params.map(p => `${p.name}:${p.type ? p.type.names.join('|') : ''}`)
        : [];
      const returns = item.returns && item.returns.length > 0
        ? item.returns.map(r => `${r.type ? r.type.names.join('|') : ''}`)
        : [];
      return {
        name: item.name,
        route: (item.tags.find(t => t.title === 'route') || {}).value || '',
        file: item.meta && item.meta.path && item.meta.filename ? path.join(item.meta.path.replace(process.cwd(), '').replace(/^\/+/g, ''), item.meta.filename) : undefined,
        params,
        returns,
        description: item.summary || item.description || item.classdesc || ''
      };
    });

  // --- Парсинг структуры БД из schema.sql ---
  function parseDbSchema(sqlFile) {
    if (!fs.existsSync(sqlFile)) return {};
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    const tables = {};
    const tableRegex = /CREATE TABLE "([^\"]+)" \(([^;]+)\);/g;
    let match;
    while ((match = tableRegex.exec(sql))) {
      const [, tableName, fieldsRaw] = match;
      const fields = {};
      fieldsRaw.split(',\n').forEach(line => {
        const fieldMatch = line.trim().match(/^"([^\"]+)"\s+([a-zA-Z0-9_\(\)]+)(.*)$/);
        if (fieldMatch) {
          const [, field, type] = fieldMatch;
          fields[field] = type;
        }
      });
      tables[tableName] = fields;
    }
    return tables;
  }
  const db_schema = parseDbSchema('schema.sql');

  const result = {
    generated_at: new Date().toISOString(),
    functions,
    db_schema
  };
  fs.writeFileSync('docs/AI_FUNCTIONS.json', JSON.stringify(result, null, 2));
  console.log('AI_FUNCTIONS.json сгенерирован, функций:', functions.length, 'таблиц:', Object.keys(db_schema).length);
} catch (error) {
  console.error('Ошибка при генерации AI_FUNCTIONS.json:', error);
  // Попытка удалить временный файл, если он остался после ошибки
  if (fs.existsSync(tempOutputFile)) {
    try {
      fs.unlinkSync(tempOutputFile);
      console.log('Временный файл tmp_jsdoc_output.json удален после ошибки.');
    } catch (unlinkErr) {
      console.error('Ошибка при удалении временного файла tmp_jsdoc_output.json после ошибки:', unlinkErr);
    }
  }
} 