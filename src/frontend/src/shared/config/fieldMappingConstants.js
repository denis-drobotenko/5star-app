// Доступные функции обработки
export const processingFunctions = {
  'NONE': {
    name: 'Без обработки',
    description: 'Использовать значение как есть'
  },
  'RIGHT': {
    name: 'Взять справа',
    description: 'Взять указанное количество символов справа',
    params: [{
      name: 'length',
      type: 'number',
      description: 'Количество символов'
    }]
  },
  'LEFT': {
    name: 'Взять слева',
    description: 'Взять указанное количество символов слева',
    params: [{
      name: 'length',
      type: 'number',
      description: 'Количество символов'
    }]
  },
  'SUBSTRING': {
    name: 'Извлечь подстроку',
    description: 'Извлечь подстроку между указанными позициями',
    params: [{
      name: 'start',
      type: 'number',
      description: 'Начальная позиция'
    }, {
      name: 'length',
      type: 'number',
      description: 'Длина подстроки'
    }]
  },
  'EXTRACT_DATE': {
    name: 'Извлечь дату',
    description: 'Извлечь дату из строки по шаблону',
    params: [{
      name: 'format',
      type: 'string',
      description: 'Формат даты (например, DD.MM.YYYY)'
    }]
  },
  'EXTRACT_DATETIME': {
    name: 'Извлечь дату и время',
    description: 'Извлечь дату и время из строки',
    params: [{
      name: 'format',
      type: 'string',
      description: 'Формат даты и времени (например, DD.MM.YYYY HH:mm:ss)'
    }]
  },
  'SPLIT': {
    name: 'Разделить строку',
    description: 'Разделить строку по разделителю и взять часть',
    params: [{
      name: 'delimiter',
      type: 'string',
      description: 'Разделитель'
    }, {
      name: 'part',
      type: 'number',
      description: 'Номер части (начиная с 1)'
    }]
  },
  'REPLACE': {
    name: 'Заменить текст',
    description: 'Заменить одну подстроку на другую',
    params: [{
      name: 'search',
      type: 'string',
      description: 'Что искать'
    }, {
      name: 'replace',
      type: 'string',
      description: 'На что заменить'
    }]
  },
  'REGEXP': {
    name: 'Регулярное выражение',
    description: 'Извлечь данные по регулярному выражению',
    params: [{
      name: 'pattern',
      type: 'string',
      description: 'Регулярное выражение'
    }, {
      name: 'group',
      type: 'number',
      description: 'Номер группы'
    }]
  }
};

export const requiredFields = [
  'order_number',
  'order_date', 
  'telephone',
  'name',
  'product',
  'quantity',
  'revenue'
];

export const targetFieldMappings = [
  // Основные данные заказа
  {
    key: 'order_number',
    name: 'Номер заказа',
    aliases: ['номер заказа', '№ заказа', 'заказ №', 'заказ номер', 'order number', 'order no', 'order id'],
    allowedProcessing: ['NONE', 'RIGHT', 'LEFT', 'SUBSTRING', 'SPLIT', 'REGEXP']
  },
  {
    key: 'order_date',
    name: 'Дата заказа',
    aliases: ['дата заказа', 'дата оформления', 'дата создания', 'order date', 'creation date'],
    allowedProcessing: ['NONE', 'EXTRACT_DATE', 'EXTRACT_DATETIME', 'RIGHT', 'SUBSTRING', 'REGEXP']
  },
  {
    key: 'delivery_date',
    name: 'Дата доставки',
    aliases: ['дата доставки', 'дата выдачи', 'дата выдачи заказа', 'delivery date'],
    allowedProcessing: ['NONE', 'EXTRACT_DATE', 'EXTRACT_DATETIME', 'RIGHT', 'SUBSTRING', 'REGEXP']
  },
  {
    key: 'category',
    name: 'Категория',
    aliases: ['категория', 'category', 'group'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'brand',
    name: 'Бренд товара',
    aliases: ['бренд', 'производитель', 'brand', 'manufacturer'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'article_number',
    name: 'Артикул',
    aliases: ['артикул', 'арт.', 'арт', 'article', 'sku', 'part number'],
    allowedProcessing: ['NONE', 'REPLACE', 'REGEXP']
  },
  {
    key: 'product',
    name: 'Товар',
    aliases: ['товар', 'наименование', 'название товара', 'номенклатура', 'product', 'item', 'description'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'quantity',
    name: 'Количество',
    aliases: ['количество', 'кол-во', 'кол', 'qty', 'quantity', 'amount'],
    allowedProcessing: ['NONE', 'REGEXP']
  },
  {
    key: 'revenue',
    name: 'Сумма',
    aliases: ['сумма', 'стоимость', 'цена', 'розница', 'розница (сумма)', 'revenue', 'price', 'total'],
    allowedProcessing: ['NONE', 'REGEXP']
  },
  {
    key: 'cost_price',
    name: 'Себестоимость',
    aliases: ['себестоимость', 'закупочная цена', 'cost price', 'purchase price'],
    allowedProcessing: ['NONE', 'REGEXP']
  },

  // Данные клиента
  {
    key: 'customer_id',
    name: 'ID клиента',
    aliases: ['id клиента', 'идентификатор клиента', 'customer id', 'client id'],
    allowedProcessing: ['NONE', 'RIGHT', 'LEFT', 'SUBSTRING', 'REGEXP']
  },
  {
    key: 'name',
    name: 'Имя или ФИО',
    aliases: ['имя', 'фио', 'имя фамилия', 'фамилия имя', 'клиент', 'first name', 'fullname', 'full name', 'customer name', 'Владелец'],
    allowedProcessing: ['NONE', 'SPLIT', 'REPLACE']
  },
  {
    key: 'last_name',
    name: 'Фамилия',
    aliases: ['фамилия', 'last name', 'lastname', 'surname'],
    allowedProcessing: ['NONE', 'SPLIT', 'REPLACE']
  },
  {
    key: 'birthday',
    name: 'День рождения',
    aliases: ['др', 'дата рождения', 'день рождения', 'birthday', 'birth date', 'date of birth', 'dob'],
    allowedProcessing: ['NONE', 'EXTRACT_DATE', 'EXTRACT_DATETIME', 'REGEXP']
  },
  {
    key: 'telephone',
    name: 'Телефон',
    aliases: ['телефон', 'тел', 'тел.', 'phone', 'mobile', 'contact'],
    allowedProcessing: ['NONE', 'REGEXP', 'REPLACE']
  },

  // Информация о местоположении
  {
    key: 'city',
    name: 'Город',
    aliases: ['город', 'city', 'town'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'subdivision',
    name: 'Подразделение',
    aliases: ['подразделение', 'отдел', 'филиал', 'subdivision', 'department', 'branch'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'pick_up_point',
    name: 'Пункт выдачи',
    aliases: ['пункт выдачи', 'пвз', 'точка выдачи', 'pickup point', 'collection point'],
    allowedProcessing: ['NONE', 'REPLACE']
  },

  // Данные об автомобиле
  {
    key: 'car_brand',
    name: 'Марка автомобиля',
    aliases: ['марка авто', 'марка', 'бренд авто', 'car brand', 'car make'],
    allowedProcessing: ['NONE', 'REPLACE']
  },
  {
    key: 'car_model',
    name: 'Модель автомобиля',
    aliases: ['модель авто', 'модель', 'car model'],
    allowedProcessing: ['NONE', 'REPLACE']
  }
]; 