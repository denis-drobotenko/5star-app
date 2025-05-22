import multer from 'multer'
import path from 'path'

// Настройка хранилища multer (в данном случае в памяти, т.к. сразу загружаем в S3)
const storage = multer.memoryStorage()

// Фильтр файлов (принимаем только изображения)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const mimetype = allowedTypes.test(file.mimetype)
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())

  if (mimetype && extname) {
    return cb(null, true)
  }
  cb(new Error('Тип файла не поддерживается. Пожалуйста, загрузите изображение (jpeg, jpg, png, gif, webp).'), false)
}

// Настройка загрузки
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Ограничение размера файла (например, 5MB)
  fileFilter: fileFilter,
})

export default upload 