export const requiredFields = [
  'order_number',
  'order_date', 
  'telephone',
  'name',
  'last_name',
  'product',
  'quantity',
  'revenue'
];

export const targetFieldMappings = {
  'order_number': {
    name: 'Номер заказа',
    aliases: ['номер заказа', '№ заказа', 'заказ №', 'заказ номер', 'order number', 'order no', 'order id']
  },
  'order_date': {
    name: 'Дата заказа',
    aliases: ['дата заказа', 'дата оформления', 'дата создания', 'order date', 'creation date']
  },
  'delivery_date': {
    name: 'Дата доставки',
    aliases: ['дата доставки', 'дата выдачи', 'дата выдачи заказа', 'delivery date']
  },
  'telephone': {
    name: 'Телефон',
    aliases: ['телефон', 'тел', 'тел.', 'phone', 'mobile', 'contact']
  },
  'name': {
    name: 'Имя',
    aliases: ['имя', 'first name', 'firstname']
  },
  'last_name': {
    name: 'Фамилия',
    aliases: ['фамилия', 'last name', 'lastname', 'surname']
  },
  'car_brand': {
    name: 'Марка автомобиля',
    aliases: ['марка авто', 'марка', 'бренд авто', 'car brand', 'car make']
  },
  'car_model': {
    name: 'Модель автомобиля',
    aliases: ['модель авто', 'модель', 'car model']
  },
  'brand': {
    name: 'Бренд товара',
    aliases: ['бренд', 'производитель', 'brand', 'manufacturer']
  },
  'article_number': {
    name: 'Артикул',
    aliases: ['артикул', 'арт.', 'арт', 'article', 'sku', 'part number']
  },
  'product': {
    name: 'Товар',
    aliases: ['товар', 'наименование', 'название товара', 'product', 'item', 'description']
  },
  'quantity': {
    name: 'Количество',
    aliases: ['количество', 'кол-во', 'кол', 'qty', 'quantity', 'amount']
  },
  'revenue': {
    name: 'Сумма',
    aliases: ['сумма', 'стоимость', 'цена', 'розница', 'розница (сумма)', 'revenue', 'price', 'total']
  }
}; 