const XLSX = require('xlsx')
const FieldMapping = require('../models/fieldMapping')
const { s3, S3_BUCKET_NAME } = require('../config/s3')
const { v4: uuidv4 } = require('uuid')

// Функция для транслитерации и очистки имени файла
const sanitizeFileName = (filename) => {
  const rusToLatMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 
    'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'J', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };

  let transliteratedName = '';
  for (let i = 0; i < filename.length; i++) {
    transliteratedName += rusToLatMap[filename[i]] || filename[i];
  }

  return transliteratedName
    .toLowerCase()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
    .replace(/[^a-z0-9\.\-]/g, '') // Удаляем все не буквы(лат)/цифры/точки/дефисы
    .replace(/-+/g, '-') // Схлопываем множественные дефисы
    .replace(/^[-.]+|[-.]+$/g, ''); // Убираем дефисы/точки в начале и конце
};

// Функция для получения данных из XLSX файла
const parseXLSX = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) // Получаем все строки как массивы
  
  if (rawRows.length === 0) {
    return {
      fields: [],
      rows: [],
      totalRows: 0,
      previewRows: 0
    };
  }
  
  const headers = rawRows[0]; // Заголовки
  const dataRowsOnly = rawRows.slice(1); // Только строки с данными (массивы значений)

  // Преобразуем строки данных в массив объектов
  let objectRows = dataRowsOnly.map(rowArray => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = rowArray[index];
    });
    return obj;
  });

  // Фильтруем строки, где есть данные только в первом столбце (или вообще нет данных кроме заголовка)
  const filteredObjectRows = objectRows.filter(row => {
    if (Object.keys(row).length === 0) return false; // Пустая строка
    // Получаем все значения столбцов КРОМЕ ПЕРВОГО (если он есть)
    const otherColumnValues = headers.length > 1 ? Object.values(row).slice(1) : Object.values(row);
    // Проверяем, есть ли хотя бы одно непустое значение в этих столбцах
    return otherColumnValues.some(value => value !== null && value !== undefined && String(value).trim() !== '');
  });
  
  // Берем только первые 100 отфильтрованных строк для предпросмотра
  const previewFilteredRows = filteredObjectRows.slice(0, 100);
  
  return {
    fields: headers,
    rows: previewFilteredRows, // Отфильтрованные и ограниченные для предпросмотра строки
    totalRows: dataRowsOnly.length, // Общее количество строк с данными в файле (до фильтрации и ограничения)
    previewRows: previewFilteredRows.length // Количество строк в предпросмотре (после фильтрации и ограничения)
  };
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
    
    // Получаем оригинальное имя для JSON ответа (с попыткой исправить кодировку)
    let originalDisplayName = req.file.originalname;
    try {
      const buffer = Buffer.from(originalDisplayName, 'latin1');
      const decodedName = buffer.toString('utf8');
      if (!decodedName.includes('\uFFFD')) {
        originalDisplayName = decodedName;
      } else {
        originalDisplayName = Buffer.from(req.file.originalname, 'utf8').toString('utf8');
      }
    } catch (e) {
      // Оставляем как есть, если декодирование не удалось
    }

    // Очищаем имя файла для ключа S3
    const sanitizedFileNameForS3 = sanitizeFileName(req.file.originalname);
    const originalFileKey = `original-xlsx-uploads/${uuidv4()}-${sanitizedFileNameForS3}`;
    
    let originalFileUrl = '';
    let signedOriginalFileUrl = '';

    try {
      await s3.putObject({
        Bucket: S3_BUCKET_NAME,
        Key: originalFileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      }).promise();
      originalFileUrl = `${process.env.S3_ENDPOINT}/${S3_BUCKET_NAME}/${originalFileKey}`;

      // Получаем подписанный URL для оригинального файла
      const signedUrlParams = {
        Bucket: S3_BUCKET_NAME,
        Key: originalFileKey,
        Expires: 3600 // URL будет действителен 1 час
      };
      signedOriginalFileUrl = await s3.getSignedUrlPromise('getObject', signedUrlParams);

    } catch (s3Error) {
      console.error('Ошибка при сохранении оригинального XLSX файла в S3:', s3Error);
      // Не прерываем выполнение, если не удалось сохранить оригинал,
      // но логируем ошибку и не передаем URL
    }
    
    res.json({
      ...result,
      originalFileUrl, 
      originalFileKey, 
      signedOriginalFileUrl, 
      originalFileName: originalDisplayName // Возвращаем "красивое" оригинальное имя для отображения
    })
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

exports.processS3XLSX = async (req, res) => {
  try {
    const { s3Key } = req.body;
    if (!s3Key) {
      return res.status(400).json({ message: 'Не указан ключ файла S3 (s3Key)' });
    }

    // 1. Скачать файл из S3
    const s3Object = await s3.getObject({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    }).promise();

    // 2. Распарсить XLSX из буфера
    const parseResult = parseXLSX(s3Object.Body); 

    // 3. Извлечь "очищенное" имя файла из ключа S3
    // Ключ S3 уже содержит очищенное имя, поэтому просто извлекаем его
    let s3FileNamePart = 'unknownfile.xlsx'; // Default
    if (s3Key.includes('/')) {
      const keyParts = s3Key.split('/');
      const fileNameWithUuid = keyParts[keyParts.length - 1];
      const uuidAndNameParts = fileNameWithUuid.split('-');
      if (uuidAndNameParts.length > 1 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(uuidAndNameParts[0])) {
        s3FileNamePart = uuidAndNameParts.slice(1).join('-');
      } else {
        // Если формат ключа неожиданный, пытаемся взять всю последнюю часть как имя
        s3FileNamePart = fileNameWithUuid;
      }
    }
    
    res.json({
      ...parseResult,
      originalFileName: s3FileNamePart, // Возвращаем очищенное имя из ключа
      s3Key
    });

  } catch (error) {
    console.error('Ошибка при обработке XLSX из S3:', error);
    if (error.code === 'NoSuchKey') {
        return res.status(404).json({ message: 'Файл не найден в S3 по указанному ключу' });
    }
    res.status(500).json({ message: 'Ошибка при обработке файла из S3' });
  }
};

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