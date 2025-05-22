import { DataTypes, Model, Sequelize } from 'sequelize';
export default (sequelize) => {
    class FieldMapping extends Model {
        constructor() {
            super(...arguments);
            // Явное объявление полей для TypeScript
            Object.defineProperty(this, "id", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            Object.defineProperty(this, "client_id", {
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
            Object.defineProperty(this, "mapping", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            }); // Или более конкретный тип
            Object.defineProperty(this, "sample_data_url", {
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
        }
        // Определение связи (если нужно)
        // public readonly client?: ClientAttributes; // Зависит от того, как определен Client
        static associate(models) {
            FieldMapping.belongsTo(models.Client, {
                foreignKey: 'client_id',
                as: 'client',
            });
        }
    }
    FieldMapping.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        client_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'clients',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        mapping: {
            type: DataTypes.JSONB,
            allowNull: false
        },
        sample_data_url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'URL файла с примером данных в S3'
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
        }
    }, {
        tableName: 'field_mappings',
        sequelize,
        timestamps: false,
        underscored: true,
        indexes: [
            {
                name: 'idx_field_mappings_client_id',
                fields: ['client_id']
            },
            {
                name: 'idx_field_mappings_mapping',
                using: 'gin',
                fields: ['mapping']
            },
            {
                name: 'idx_field_mappings_sample_data_url',
                fields: ['sample_data_url']
            }
        ]
    });
    return FieldMapping;
};
