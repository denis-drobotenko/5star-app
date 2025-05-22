import { DataTypes, Model, Sequelize, Optional } from 'sequelize';

// Интерфейс для атрибутов FieldMapping
export interface FieldMappingAttributes {
  id: number;
  client_id: number;
  name: string;
  mapping: object; // Или более конкретный тип, если известен
  sample_data_url?: string | null;
  created_at: Date;
  updated_at: Date;
  // Если есть связи, например, с Client, можно добавить сюда
  client?: any; // Тип для связанной модели Client, если она подгружается
}

// Интерфейс для создания FieldMapping (некоторые поля опциональны)
interface FieldMappingCreationAttributes extends Optional<FieldMappingAttributes, 'id' | 'sample_data_url' | 'created_at' | 'updated_at' | 'client'> {}

export default (sequelize: Sequelize) => {
  class FieldMapping extends Model<FieldMappingAttributes, FieldMappingCreationAttributes> implements FieldMappingAttributes {
    // Явное объявление полей для TypeScript
    public id!: number;
    public client_id!: number;
    public name!: string;
    public mapping!: object; // Или более конкретный тип
    public sample_data_url?: string | null;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;

    // Определение связи (если нужно)
    // public readonly client?: ClientAttributes; // Зависит от того, как определен Client

    public static associate(models: any) {
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