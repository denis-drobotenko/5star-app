import { DataTypes, Model } from 'sequelize';
export default (sequelize) => {
    class ImportHistory extends Model {
    }
    ImportHistory.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        client_id: {
            type: DataTypes.INTEGER,
            allowNull: true, // В соответствии с schema.sql, может быть NULL
            references: {
                model: 'clients', // Имя таблицы, на которую ссылаемся
                key: 'id',
            },
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users', // Имя таблицы, на которую ссылаемся
                key: 'id',
            },
        },
        file_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        custom_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        source_type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        source_link: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        s3_key_original_file: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        s3_key_processed_data: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        s3_key_error_data: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        field_mapping_id: {
            type: DataTypes.INTEGER,
            allowNull: true, // Может быть true, если загрузка может быть без маппинга, или false если маппинг обязателен
            references: {
                model: 'field_mappings',
                key: 'id',
            },
            // onDelete: 'SET NULL', // или 'RESTRICT' / 'NO ACTION'
            // onUpdate: 'CASCADE',
        },
        rows_total: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        rows_processed: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        rows_successfully_previewed: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        rows_failed_preview: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        rows_successfully_imported: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        rows_failed: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        status_details: {
            type: DataTypes.TEXT, // Используем TEXT для более длинных сообщений
            allowNull: true,
        },
        processing_finished_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        execution_finished_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        error_log: {
            type: DataTypes.JSONB, // Используем JSONB для структурированных логов ошибок
            allowNull: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'import_history',
        sequelize,
        timestamps: true, // Sequelize будет управлять полями createdAt и updatedAt
        createdAt: 'created_at',
        updatedAt: 'updated_at', // Включаем updatedAt и указываем имя поля
    });
    return ImportHistory;
};
