const XLSX = require('xlsx')
const FieldMapping = require('../models/fieldMapping')

// Функция для получения данных из XLSX файла
const parseXLSX = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
  
  // Получаем заголовки (первая строка)
  const headers = rows[0]
  
  // Берем только первые 100 строк для предпросмотра
  const previewRows = rows.slice(1, 101)
  
  // Преобразуем данные в массив объектов
  const data = previewRows.map(row => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = row[index]
    })
    return obj
  })
  
  return {
    fields: headers,
    rows: data,
    totalRows: rows.length - 1, // Общее количество строк (без учета заголовков)
    previewRows: data.length // Количество строк в предпросмотре
  }
}

exports.uploadXLSX = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' })
    }

    // Проверяем размер файла
    const fileSizeInMB = req.file.size / (1024 * 1024)
    if (fileSizeInMB > 20) {
      return res.status(400).json({ 
        message: `Размер файла (${fileSizeInMB.toFixed(2)}MB) превышает допустимый лимит в 20MB` 
      })
    }

    const result = parseXLSX(req.file.buffer)
    
    res.json(result)
  } catch (error) {
    console.error('Ошибка при обработке XLSX:', error)
    
    // Обработка специфических ошибок
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'Размер файла превышает допустимый лимит в 20MB' 
      })
    }
    
    res.status(500).json({ message: 'Ошибка при обработке файла' })
  }
}

// exports.saveMapping = async (req, res) => {
//   try {
//     const { mapping, name } = req.body
//     const companyId = req.user.company_id // Предполагаем, что у пользователя есть привязка к компании

//     // Создаем новый маппинг
//     const fieldMapping = await FieldMapping.create({
//       company_id: companyId,
//       name,
//       mapping: mapping,
//       created_at: new Date(),
//       updated_at: new Date()
//     })

//     res.json({ 
//       message: 'Маппинг успешно сохранен',
//       mapping: fieldMapping 
//     })
//   } catch (error) {
//     console.error('Ошибка при сохранении маппинга:', error)
//     res.status(500).json({ message: 'Ошибка при сохранении маппинга' })
//   }
// } 