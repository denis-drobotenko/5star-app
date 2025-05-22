import { DataTypes, Model } from 'sequelize';
export default (sequelize) => {
    // Расширяем класс Model с использованием наших интерфейсов
    class User extends Model {
        // Для корректной работы TypeScript и автодополнения,
        // можно объявить поля здесь с их типами
        public id!: number;
        public username!: string;
        public password_hash!: string;
        public full_name?: string | null;
        public email!: string;
        public phone?: string | null;
        public position?: string | null;
        public role!: string; // Consider using an enum: 'ADMIN' | 'USER' | 'MANAGER'
        public user_type!: string; // Consider using an enum: 'INTERNAL' | 'CLIENT'
        public is_active!: boolean;
        public client_id?: number | null;
        public company_id?: number | null;
        public reset_password_token?: string | null;
        public reset_password_expires_at?: Date | null;
        public readonly created_at!: Date;
        public readonly updated_at!: Date;
        
        // Здесь можно добавить кастомные методы экземпляра или статические методы
        // Например, для связей:
        // public readonly client?: ClientAttributes;
        // public readonly company?: CompanyAttributes;
        static associate(models) {
            User.belongsTo(models.Client, {
                foreignKey: 'client_id',
                as: 'client'
            });
            User.belongsTo(models.Company, {
                foreignKey: 'company_id',
                as: 'company'
            });
        }
    }
    User.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        position: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false
        },
        user_type: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['INTERNAL', 'CLIENT']]
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        client_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'clients', // имя таблицы
                key: 'id'
            }
        },
        company_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'companies', // имя таблицы
                key: 'id'
            }
        },
        reset_password_token: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        reset_password_expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        // Sequelize автоматически обрабатывает created_at и updated_at, 
        // если timestamps: true и поля называются created_at, updated_at (или createdAt, updatedAt с underscored: true)
        // Явное определение здесь не обязательно, если настройки корректны, но оставлю для ясности
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            // defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') // Можно использовать для СУБД, если нужно
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            // defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
    }, {
        tableName: 'users',
        sequelize,
        timestamps: true, // Включаем автоматические метки времени
        createdAt: 'created_at', // Указываем Sequelize, что поле называется created_at
        updatedAt: 'updated_at', // Указываем Sequelize, что поле называется updated_at
        underscored: true // Используем snake_case для автоматически генерируемых имен столбцов (например, foreign keys)
    });
    return User;
};
