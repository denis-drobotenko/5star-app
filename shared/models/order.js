import { DataTypes, Model } from 'sequelize';
export default (sequelize) => {
    class Order extends Model {
    }
    Order.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        subdivision: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        pick_up_point: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        order_number: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        order_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        delivery_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        customer_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        telephone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        last_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        birthday: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        car_brand: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        car_model: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        article_number: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        product: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        revenue: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        cost_price: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        entry_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        entry_user: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        session_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'import_history',
                key: 'id',
            },
        },
        client_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'clients',
                key: 'id',
            },
        },
    }, {
        tableName: 'orders',
        sequelize,
        timestamps: false,
    });
    return Order;
};
// Возможные связи (если customer_id, entry_user или session_id это внешние ключи):
// Order.belongsTo(models.User, { foreignKey: 'entry_user', targetKey: 'email' }); // Пример, если entry_user это email пользователя
// Order.belongsTo(models.ImportHistory, { foreignKey: 'session_id', targetKey: 'id' }); // Пример, если session_id это id из ImportHistory
// module.exports = Order; 
