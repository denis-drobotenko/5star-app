import { DataTypes, Model } from 'sequelize';
export default (sequelize) => {
    class Client extends Model {
        constructor() {
            super(...arguments);
            // Явное объявление полей для TypeScript
            Object.defineProperty(this, "id", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "name", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "logo_url", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "created_at", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "updated_at", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            // Тут могут быть связи, например, с Company или User
            // public static associate(models: any) {
            //   Client.hasMany(models.Company, { foreignKey: 'client_id', as: 'companies' });
            //   Client.hasMany(models.User, { foreignKey: 'client_id', as: 'users' }); // Если пользователи привязаны к клиентам напрямую
            // }
        }
    }
    Client.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        logo_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        }
    }, {
        tableName: 'clients',
        sequelize,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        underscored: true,
    });
    return Client;
};
