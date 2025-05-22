import React, { useState, useEffect } from 'react';
import { Button, Typography, Form, Input, Select, Skeleton, Upload, Progress, Empty, Space, App, Card, InputNumber, Modal, Table, Divider, Alert } from 'antd';
import { InfoCircleOutlined, UploadOutlined, LeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, SettingOutlined, LinkOutlined } from '@ant-design/icons';
import { API_URL } from '../constants/appConstants';
import { requiredFields, targetFieldMappings, processingFunctions } from '../shared/config/fieldMappingConstants';
import '../assets/forms.css';
import apiClient from '../shared/api/apiClient';

const { Title, Paragraph } = Typography;

// Компонент для выбора функции обработки и её параметров
const ProcessingFunctionSelect = ({ value, onChange, field }) => {
  const [selectedFunction, setSelectedFunction] = useState(value?.function || 'NONE');
  
  const handleFunctionChange = (funcName) => {
    setSelectedFunction(funcName);
    const newValue = {
      function: funcName,
      params: {}
    };
    if (processingFunctions[funcName]?.params) {
      processingFunctions[funcName].params.forEach(param => {
        newValue.params[param.name] = '';
      });
    }
    onChange(newValue);
  };

  const handleParamChange = (paramName, paramValue) => {
    onChange({
      function: selectedFunction,
      params: {
        ...(value?.params || {}),
        [paramName]: paramValue
      }
    });
  };

  // Получаем список разрешенных функций для данного поля
  const allowedFunctions = targetFieldMappings[field]?.allowedProcessing || ['NONE'];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Select
        value={selectedFunction}
        onChange={handleFunctionChange}
        style={{ width: '100%' }}
        size="small"
      >
        {allowedFunctions.map(funcName => (
          <Select.Option key={funcName} value={funcName}>
            {processingFunctions[funcName].name}
          </Select.Option>
        ))}
      </Select>
      
      {selectedFunction !== 'NONE' && processingFunctions[selectedFunction]?.params && (
        <Space wrap size={8}>
          {processingFunctions[selectedFunction].params.map(param => (
            <div key={param.name}>
              {param.type === 'number' ? (
                <InputNumber
                  size="small"
                  placeholder={param.description}
                  value={value?.params?.[param.name]}
                  onChange={(val) => handleParamChange(param.name, val)}
                  style={{ width: 120 }}
                />
              ) : (
                <Input
                  size="small"
                  placeholder={param.description}
                  value={value?.params?.[param.name]}
                  onChange={(e) => handleParamChange(param.name, e.target.value)}
                  style={{ width: 120 }}
                />
              )}
            </div>
          ))}
        </Space>
      )}
    </Space>
  );
};

// Компонент настройки функции обработки
const ProcessingSettingsModal = ({ visible, onCancel, onSave, field, sourceField, initialProcessing, previewData }) => {
  const [selectedFunction, setSelectedFunction] = useState(initialProcessing?.function || 'NONE');
  const [params, setParams] = useState(initialProcessing?.params || {});
  const [previewPage, setPreviewPage] = useState(0);
  const pageSize = 5;

  // Получаем список разрешенных функций для данного поля
  const allowedFunctions = targetFieldMappings[field]?.allowedProcessing || ['NONE'];

  // Обработка значения функцией
  const processValue = (value) => {
    if (selectedFunction === 'NONE' || !value) return value;
    
    try {
      switch (selectedFunction) {
        case 'RIGHT':
          return value.slice(-params.length);
        case 'LEFT':
          return value.slice(0, params.length);
        case 'SUBSTRING':
          return value.slice(params.start, params.start + params.length);
        case 'EXTRACT_DATE':
          const dateMatch = value.match(/\d{2}\.\d{2}\.\d{4}/);
          return dateMatch ? dateMatch[0] : value;
        case 'EXTRACT_DATETIME':
          const datetimeMatch = value.match(/\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}/);
          return datetimeMatch ? datetimeMatch[0] : value;
        case 'SPLIT':
          const parts = value.split(params.delimiter);
          return parts[params.part - 1] || value;
        case 'REPLACE':
          return value.replace(params.search, params.replace);
        case 'REGEXP':
          const regexMatch = value.match(new RegExp(params.pattern));
          return regexMatch ? regexMatch[params.group] : value;
        default:
          return value;
      }
    } catch (e) {
      return `Ошибка обработки: ${e.message}`;
    }
  };

  // Получаем данные для предпросмотра
  const getPreviewData = () => {
    if (!previewData || !Array.isArray(previewData)) {
      return [];
    }
    const startIdx = previewPage * pageSize;
    const endIdx = startIdx + pageSize;
    return previewData.slice(startIdx, endIdx).map((row, idx) => ({
      key: startIdx + idx,
      original: row[sourceField] || '',
      processed: processValue(row[sourceField] || '')
    }));
  };

  // Проверяем, все ли обязательные параметры заполнены
  const isValid = () => {
    if (selectedFunction === 'NONE') return true;
    
    const func = processingFunctions[selectedFunction];
    if (!func?.params) return true;

    // Для функций извлечения дат параметры необязательны
    if (selectedFunction === 'EXTRACT_DATE' || selectedFunction === 'EXTRACT_DATETIME') return true;

    return func.params.every(param => {
      const value = params[param.name];
      return value !== undefined && value !== null && value !== '';
    });
  };

  const totalRows = previewData?.length || 0;
  const hasPreviewData = totalRows > 0;

  return (
    <Modal
      title="Настройка обработки поля"
      open={visible}
      onCancel={onCancel}
      width={800}
      okButtonProps={{ disabled: !isValid() }}
      onOk={() => onSave({ function: selectedFunction, params })}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Typography.Text strong>Функция обработки:</Typography.Text>
          <Select
            value={selectedFunction}
            onChange={setSelectedFunction}
            style={{ width: '100%' }}
          >
            {allowedFunctions.map(funcName => (
              <Select.Option key={funcName} value={funcName}>
                {processingFunctions[funcName].name}
              </Select.Option>
            ))}
          </Select>
        </Space>

        {selectedFunction !== 'NONE' && processingFunctions[selectedFunction]?.params && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Typography.Text strong>Параметры:</Typography.Text>
            <Space wrap>
              {processingFunctions[selectedFunction].params.map(param => (
                <div key={param.name}>
                  {param.type === 'number' ? (
                    <InputNumber
                      placeholder={param.description}
                      value={params[param.name]}
                      onChange={(val) => setParams({ ...params, [param.name]: val })}
                      style={{ width: 160 }}
                    />
                  ) : (
                    <Input
                      placeholder={param.description}
                      value={params[param.name]}
                      onChange={(e) => setParams({ ...params, [param.name]: e.target.value })}
                      style={{ width: 160 }}
                    />
                  )}
                </div>
              ))}
            </Space>
          </Space>
        )}

        <div style={{ width: '100%' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 8,
            width: '100%'
          }}>
            <Typography.Text strong>Предпросмотр результатов:</Typography.Text>
            {hasPreviewData && (
              <div style={{ width: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <Button
                  icon={<LeftOutlined />}
                  disabled={previewPage === 0}
                  onClick={() => setPreviewPage(prev => Math.max(0, prev - 1))}
                />
                <Typography.Text style={{ width: 200, textAlign: 'center' }}>
                  Записи {previewPage * pageSize + 1}-{Math.min((previewPage + 1) * pageSize, totalRows)} из {totalRows}
                </Typography.Text>
                <Button
                  icon={<RightOutlined />}
                  disabled={(previewPage + 1) * pageSize >= totalRows}
                  onClick={() => setPreviewPage(prev => prev + 1)}
                />
              </div>
            )}
          </div>
          {hasPreviewData ? (
            <Table
              columns={[
                {
                  title: 'Исходное значение',
                  dataIndex: 'original',
                  key: 'original',
                  width: '65%',
                  ellipsis: true
                },
                {
                  title: 'После обработки',
                  dataIndex: 'processed',
                  key: 'processed',
                  width: '35%',
                  ellipsis: true
                }
              ]}
              dataSource={getPreviewData()}
              pagination={false}
              size="small"
            />
          ) : (
            <Empty description="Нет данных для предпросмотра" />
          )}
        </div>
      </Space>
    </Modal>
  );
};

// Компонент для отображения кнопки настройки обработки
const ProcessingSettingsButton = ({ value, onChange, field, sourceField, previewData, disabled }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const getButtonText = () => {
    return 'Обработать'; // Всегда отображаем "Обработать"
  };

  return (
    <>
      <Button
        icon={<SettingOutlined />}
        onClick={() => setModalVisible(true)}
        size="small"
        style={{ 
          width: '100%',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}
        disabled={disabled}
      >
        {getButtonText()}
      </Button>
      <ProcessingSettingsModal
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onSave={(newValue) => {
          onChange(newValue);
          setModalVisible(false);
        }}
        field={field}
        sourceField={sourceField}
        initialProcessing={value}
        previewData={previewData}
      />
    </>
  );
};

// Компонент для отдельного поля маппинга
const MappingField = ({ fieldKey, fieldInfo, form, sourceFields, fileData, currentRowIndex }) => {
  const selectedField = Form.useWatch(['mapping', fieldKey, 'field'], form);
  const selectedProcessing = Form.useWatch(['mapping', fieldKey, 'processing'], form);

  // Функция для обработки значения согласно выбранной функции
  const processValue = (value) => {
    if (!selectedProcessing || selectedProcessing.function === 'NONE' || !value) return value;
    
    try {
      switch (selectedProcessing.function) {
        case 'RIGHT':
          return value.slice(-selectedProcessing.params.length);
        case 'LEFT':
          return value.slice(0, selectedProcessing.params.length);
        case 'SUBSTRING':
          return value.slice(selectedProcessing.params.start, selectedProcessing.params.start + selectedProcessing.params.length);
        case 'EXTRACT_DATE':
          const dateMatch = value.match(/\d{2}\.\d{2}\.\d{4}/);
          return dateMatch ? dateMatch[0] : value;
        case 'EXTRACT_DATETIME':
          const datetimeMatch = value.match(/\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}/);
          return datetimeMatch ? datetimeMatch[0] : value;
        case 'SPLIT':
          const parts = value.split(selectedProcessing.params.delimiter);
          return parts[selectedProcessing.params.part - 1] || value;
        case 'REPLACE':
          return value.replace(selectedProcessing.params.search, selectedProcessing.params.replace);
        case 'REGEXP':
          const regexMatch = value.match(new RegExp(selectedProcessing.params.pattern));
          return regexMatch ? regexMatch[selectedProcessing.params.group] : value;
        default:
          return value;
      }
    } catch (e) {
      return `Ошибка обработки: ${e.message}`;
    }
  };

  // Получаем текущее значение и обработанное значение
  const currentValue = selectedField && fileData && Array.isArray(fileData) && 
    fileData[currentRowIndex] ? fileData[currentRowIndex][selectedField] : '';
  const processedValue = processValue(currentValue);

  return (
    <Form.Item
      key={fieldKey}
      label={fieldInfo.name}
      required={requiredFields.includes(fieldKey)}
      className="form-item-spacing"
    >
      {/* Контейнер для Поля выбора и Кнопки настройки обработки */}
      <div style={{ 
        display: 'flex', // Используем flexbox для размещения в строку
        gap: '8px', // Отступ между элементами в строке
        width: '100%',
        alignItems: 'center',
        marginBottom: '8px' // Отступ перед блоком с обработкой и примером
      }}> 
        {/* Селект для выбора поля */}
        <Form.Item
          name={['mapping', fieldKey, 'field']}
          rules={[
            { 
              required: requiredFields.includes(fieldKey),
              message: `Пожалуйста, выберите поле для "${fieldInfo.name}"` 
            }
          ]}
          style={{ marginBottom: 0, flex: 1 }} // flex: 1 делает поле "резиновым", marginBottom: 0 убирает стандартный отступ Form.Item
        >
          <Select
            placeholder="Выберите поле"
            allowClear
          >
            {/* Изменяем отображение опций для показа примера данных */}
            {sourceFields.map(field => (
              <Select.Option key={field} value={field}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text strong>{field}:</Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ flex: 1, marginLeft: '8px' }}>
                    {/* Отображаем пример значения из текущей строки */} 
                    {(fileData && Array.isArray(fileData) && fileData[currentRowIndex] && fileData[currentRowIndex][field] !== undefined && fileData[currentRowIndex][field] !== null)
                      ? String(fileData[currentRowIndex][field])
                      : 'Нет данных'}
                  </Typography.Text>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* Кнопка настройки обработки */}
        {fieldInfo.allowedProcessing.length > 1 && ( /* Показываем кнопку только если есть разрешенные функции кроме NONE */
          <Form.Item
            name={['mapping', fieldKey, 'processing']}
            style={{ marginBottom: 0, width: 140, flexShrink: 0 }} // Фиксированная ширина, flexShrink: 0 предотвращает сжатие
          >
            <ProcessingSettingsButton
              field={fieldKey}
              sourceField={selectedField}
              previewData={fileData}
              disabled={!selectedField}
            />
          </Form.Item>
        )}
      </div>

      {/* Блок для отображения функции обработки и примера данных */}
      {selectedField && ( /* Показываем этот блок только если выбрано поле */
        <div style={{
          display: 'flex', // Используем flexbox для размещения в строку
          gap: '8px', // Отступ между функцией и примером
          width: '100%',
          alignItems: 'center',
          minHeight: '32px' // Минимальная высота для выравнивания
        }}>
          {/* Отображение выбранной функции обработки */}
          <div style={{ flexShrink: 0 }}> {/* Фиксированный размер или автоматический, но не сжимаемый */}
            <Typography.Text type="secondary">
              {selectedProcessing?.function && selectedProcessing.function !== 'NONE'
                ? `${processingFunctions[selectedProcessing.function]?.name || 'Неизвестная функция'}`
                : 'Без обработки'}
            </Typography.Text>
          </div>

          {/* Пример данных */}
          <div style={{ 
            padding: '4px 11px',
            background: '#fafafa',
            borderRadius: '6px',
            fontSize: '14px',
            flex: 1, // Пример данных занимает оставшееся место
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minHeight: '32px' // Минимальная высота
          }}>
            {processedValue !== undefined && processedValue !== null ? String(processedValue) : ''}
          </div>
        </div>
      )}
    </Form.Item>
  );
};

function FieldMappingPage() {
  const { message } = App.useApp();
  const [fileData, setFileData] = useState(null)
  const [sourceFields, setSourceFields] = useState([])
  const [currentRowIndex, setCurrentRowIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [previewRows, setPreviewRows] = useState(0)
  const [processingFile, setProcessingFile] = useState(false)
  const [mappings, setMappings] = useState([])
  const [filteredMappings, setFilteredMappings] = useState([])
  const [loadingMappings, setLoadingMappings] = useState(false)
  const [autoMappingComplete, setAutoMappingComplete] = useState(false)
  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [selectedId, setSelectedId] = useState(null)
  const [originalXlsxFileUrl, setOriginalXlsxFileUrl] = useState(null);
  const [originalXlsxFileName, setOriginalXlsxFileName] = useState(null);
  const [loadingFileData, setLoadingFileData] = useState(false);
  const [isLoadingDetailPane, setIsLoadingDetailPane] = useState(false);
  
  // Добавляем отслеживание всех полей формы
  const formValues = Form.useWatch([], form);
  const [isValid, setIsValid] = useState(false);

  // Обновляем валидацию при изменении значений формы
  useEffect(() => {
    if (formValues && (selectedId === 'new' || selectedId)) { // Вызываем isMappingValid только если есть выбранный ID (включая 'new')
                                                              // чтобы не вызывать на пустой форме при первой загрузке
      const valid = isMappingValid(false); // Вызываем без показа сообщений
      setIsValid(valid);
    } else if (!selectedId) {
      setIsValid(false); // Если ничего не выбрано (дефолтное состояние), форма невалидна для сабмита
    }
  }, [formValues, selectedId]); // Добавляем selectedId в зависимости

  // Добавляем эффект для фильтрации маппингов
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredMappings(mappings);
      return;
    }
    
    const filtered = mappings.filter(mapping => 
      mapping.name.toLowerCase().includes(searchText.toLowerCase()) ||
      mapping.client?.name?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredMappings(filtered);
  }, [searchText, mappings]);

  const isMappingValid = (showMessages = false) => { // Добавим флаг для управления сообщениями
    const values = form.getFieldsValue();

    if (!values.name || values.name.trim() === '') {
      if (showMessages) message.error('Не указано название маппинга');
      return false;
    }
    if (!values.client_id) {
      if (showMessages) message.error('Не выбран клиент');
      return false;
    }

    // Проверка sample_data_url или fileData только если это новый маппинг или если нет sample_data_url
    // Для существующего маппинга с sample_data_url, файл может быть еще не загружен в fileData при проверке
    const isNewMappingMode = selectedId === 'new';
    if (isNewMappingMode && !fileData && !originalXlsxFileUrl) { // Для нового - файл обязателен
        if (showMessages) message.error('Не загружен XLSX файл с примером данных для нового маппинга.');
        return false;
    }
    // Если это не новый маппинг, но и URL нет (например, его удалили или это старый маппинг без URL),
    // то файл тоже должен быть загружен, если мы хотим его валидировать по содержимому.
    // Но для простой валидации полей маппинга сам файл не всегда нужен, если sourceFields уже есть.
    // Пока оставим проверку, что ХОТЯ БЫ ЧТО-ТО есть, если это не просто открытие существующего.
    if (!fileData && !originalXlsxFileUrl && sourceFields.length === 0) {
        if (showMessages) message.error('Отсутствуют поля для маппинга (не загружен файл или файл пуст).');
        return false;
    }


    if (!values.mapping || Object.keys(values.mapping).length === 0) {
      if (showMessages) message.error('Отсутствуют правила сопоставления полей.');
      return false;
    }

    for (const field in targetFieldMappings) {
      if (targetFieldMappings[field]?.required) {
        const fieldMapping = values.mapping[field];
        if (!fieldMapping || !fieldMapping.field) {
          if (showMessages) message.error(`Не выбрано сопоставление для обязательного поля: ${targetFieldMappings[field].name}`);
          return false;
        }
        // Проверка параметров для функций обработки (если нужно будет, можно раскомментировать и доработать)
        /*
        if (fieldMapping.processing && fieldMapping.processing.function !== 'NONE') {
          const funcDef = processingFunctions.find(f => f.id === fieldMapping.processing.function); // processingFunctions должен быть массивом объектов с id, name, params
          if (funcDef && funcDef.params) {
            for (const param of funcDef.params) {
              if (param.required && 
                  (typeof fieldMapping.processing.params?.[param.name] === 'undefined' || 
                   fieldMapping.processing.params?.[param.name] === '' || 
                   (Array.isArray(fieldMapping.processing.params?.[param.name]) && fieldMapping.processing.params?.[param.name].length === 0)))
              {
                if (showMessages) message.error(`В поле "${targetFieldMappings[field].name}" (${field}) не заполнен обязательный параметр "${param.label || param.name}" для функции обработки "${funcDef.name}"`);
                return false;
              }
            }
          }
        }
        */
      }
    }
    return true;
  };

  const logToFile = async (messageText, data = null) => { // переименовал message в messageText во избежание конфликта с message из antd
    try {
      const timestamp = new Date().toISOString();
      let logMessage = `\n[${timestamp}] ${messageText}`;
      if (data) {
        logMessage += '\n' + JSON.stringify(data, null, 2);
      }
      
      const response = await fetch(`${API_URL}/api/debug/debug-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: logMessage })
      });
      
      if (!response.ok) {
        console.error('Failed to write to log file');
      }
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  };

  const autoMapFields = async (currentSourceFields) => {
    const startTime = performance.now();
    await logToFile('🕒 СТАРТ АВТОМАППИНГА', {
      timestamp: new Date().toISOString(),
      fieldsCount: currentSourceFields.length,
      sourceFields: currentSourceFields,
      fileDataLength: fileData?.length || 0
    });

    const normalizeField = (field) => {
      return field.toLowerCase()
        .replace(/[_\-\.()№]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    const mapping = {};
    const usedSourceFields = new Set();

    // Анализ данных в колонках
    const columnAnalysis = {};
    await logToFile('📊 Начало анализа колонок', {
      hasFileData: !!fileData,
      fileDataLength: fileData?.length || 0,
      firstRow: fileData?.[0],
      sourceFieldsLength: currentSourceFields?.length || 0
    });

    if (fileData && fileData.length > 0) {
      for (const field of currentSourceFields) {
        await logToFile(`Анализ поля: ${field}`, {
          fieldValue: field,
          sampleRow: fileData[0]?.[field],
          hasField: field in fileData[0]
        });

        columnAnalysis[field] = {
          hasDateTime: false,
          hasDate: false,
          hasPhoneNumber: false,
          hasPrice: false,
          hasQuantity: false,
          samples: []
        };

        // Анализируем первые 10 строк
        const samplesToAnalyze = fileData.slice(0, Math.min(10, fileData.length));
        for (const row of samplesToAnalyze) {
          if (!row || !field) {
            await logToFile(`Пропуск строки для поля ${field}`, {
              hasRow: !!row,
              hasField: !!field
            });
            continue;
          }
          
          const value = String(row[field] || '');
          await logToFile(`Анализ значения для поля ${field}`, {
            rawValue: row[field],
            processedValue: value,
            rowKeys: Object.keys(row)
          });

          if (!value) continue;

          columnAnalysis[field].samples.push(value);

          // Проверка на дату и время
          if (value.match(/\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}/)) {
            columnAnalysis[field].hasDateTime = true;
          }
          // Проверка на дату
          else if (value.match(/\d{2}\.\d{2}\.\d{4}/)) {
            columnAnalysis[field].hasDate = true;
          }
          // Проверка на телефон
          else if (value.match(/[\+]?[78][\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/)) {
            columnAnalysis[field].hasPhoneNumber = true;
          }
          // Проверка на цену
          else if (value.match(/^\d+([.,]\d{2})?$/)) {
            columnAnalysis[field].hasPrice = true;
          }
          // Проверка на количество
          else if (value.match(/^\d+$/)) {
            columnAnalysis[field].hasQuantity = true;
          }
        }

        await logToFile(`Результаты анализа поля ${field}`, {
          analysis: columnAnalysis[field]
        });
      }

      await logToFile('📊 Анализ колонок завершен', {
        columnAnalysis,
        analysisKeys: Object.keys(columnAnalysis)
      });
    } else {
      await logToFile('⚠️ Нет данных для анализа колонок', {
        fileData: fileData,
        currentSourceFields: currentSourceFields
      });
    }

    // Замеряем время создания карты алиасов
    const aliasMapStartTime = performance.now();
    const aliasToTargetMap = new Map();
    Object.entries(targetFieldMappings).forEach(([targetField, info]) => {
      info.aliases.forEach(alias => {
        aliasToTargetMap.set(normalizeField(alias), targetField);
      });
      aliasToTargetMap.set(normalizeField(info.name), targetField);
    });
    const aliasMapEndTime = performance.now();
    await logToFile('⏱️ Создание карты алиасов завершено', {
      timeMs: aliasMapEndTime - aliasMapStartTime,
      aliasCount: aliasToTargetMap.size
    });

    // Этап 1: Точные совпадения с анализом данных
    const exactMatchStartTime = performance.now();
    await logToFile('📌 ЭТАП 1: Проверка точных совпадений с анализом данных');
    let exactMatchesFound = 0;

    for (const sourceField of currentSourceFields) {
      const normalizedSource = normalizeField(sourceField);
      const targetField = aliasToTargetMap.get(normalizedSource);
      
      if (targetField && !mapping[targetField]) {
        // Создаем объект маппинга с функцией обработки
        mapping[targetField] = {
          field: sourceField,
          processing: determineProcessingFunction(targetField, columnAnalysis[sourceField])
        };
          usedSourceFields.add(sourceField);
        exactMatchesFound++;
      }
    }
    
    const exactMatchEndTime = performance.now();
    await logToFile('⏱️ Этап точных совпадений завершен', {
      timeMs: exactMatchEndTime - exactMatchStartTime,
      matchesFound: exactMatchesFound
    });

    // Этап 2: Частичные совпадения с анализом данных
    const partialMatchStartTime = performance.now();
    await logToFile('📌 ЭТАП 2: Проверка частичных совпадений с анализом данных');
    let partialMatchesChecked = 0;
    let partialMatchesFound = 0;

    const unmappedRequiredFields = requiredFields.filter(field => !mapping[field]);
    if (unmappedRequiredFields.length > 0) {
      await logToFile('Поиск совпадений для незамапленных обязательных полей:', unmappedRequiredFields);

      for (const sourceField of currentSourceFields) {
        if (usedSourceFields.has(sourceField)) continue;

        const normalizedSource = normalizeField(sourceField);
        let foundMatch = false;

        for (const [alias, targetField] of aliasToTargetMap.entries()) {
          partialMatchesChecked++;
          if (mapping[targetField]) continue;

          if (normalizedSource.includes(alias) || alias.includes(normalizedSource)) {
            mapping[targetField] = {
              field: sourceField,
              processing: determineProcessingFunction(targetField, columnAnalysis[sourceField])
            };
          usedSourceFields.add(sourceField);
            partialMatchesFound++;
            foundMatch = true;
          break;
          }
        }

        if (foundMatch) {
          await logToFile(`✅ Найдено частичное совпадение для: ${sourceField}`);
        }
      }
    }

    // Этап 3: Сопоставление по типу данных
    await logToFile('📌 ЭТАП 3: Сопоставление по типу данных');
    for (const sourceField of currentSourceFields) {
      if (usedSourceFields.has(sourceField)) continue;

      const analysis = columnAnalysis[sourceField];
      if (!analysis) {
        await logToFile(`Пропуск поля ${sourceField} - нет данных анализа`);
        continue;
      }

      let matched = false;

      // Пытаемся сопоставить поля по типу данных
      if (analysis.hasDateTime && !mapping['order_date']) {
        mapping['order_date'] = {
          field: sourceField,
          processing: determineProcessingFunction('order_date', analysis)
        };
        matched = true;
      } else if (analysis.hasDate && !mapping['delivery_date']) {
        mapping['delivery_date'] = {
          field: sourceField,
          processing: determineProcessingFunction('delivery_date', analysis)
        };
        matched = true;
      } else if (analysis.hasPhoneNumber && !mapping['telephone']) {
        mapping['telephone'] = {
          field: sourceField,
          processing: determineProcessingFunction('telephone', analysis)
        };
        matched = true;
      } else if (analysis.hasPrice && !mapping['revenue']) {
        mapping['revenue'] = {
          field: sourceField,
          processing: determineProcessingFunction('revenue', analysis)
        };
        matched = true;
      } else if (analysis.hasQuantity && !mapping['quantity']) {
        mapping['quantity'] = {
          field: sourceField,
          processing: determineProcessingFunction('quantity', analysis)
        };
        matched = true;
      }

      if (matched) {
        usedSourceFields.add(sourceField);
        await logToFile(`✅ Сопоставлено по типу данных: ${sourceField}`);
      }
    }

    const partialMatchEndTime = performance.now();
    await logToFile('⏱️ Этап частичных совпадений и анализа данных завершен', {
      timeMs: partialMatchEndTime - partialMatchStartTime,
      checksPerformed: partialMatchesChecked,
      matchesFound: partialMatchesFound
    });

    // Проверка результатов
    const missingRequiredFields = requiredFields.filter(field => !mapping[field]);
    if (missingRequiredFields.length > 0) {
      await logToFile('⚠️ ВНИМАНИЕ: Не все обязательные поля были сопоставлены:', missingRequiredFields);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    await logToFile('📊 ИТОГОВЫЙ РЕЗУЛЬТАТ', {
      totalTimeMs: totalTime,
      totalFieldsProcessed: currentSourceFields.length,
      exactMatches: exactMatchesFound,
      partialMatches: partialMatchesFound,
      mapping,
      usedSourceFields: Array.from(usedSourceFields),
      unmappedFields: currentSourceFields.filter(f => !usedSourceFields.has(f)),
      missingRequiredFields,
      performance: {
        aliasMapCreation: aliasMapEndTime - aliasMapStartTime,
        exactMatching: exactMatchEndTime - exactMatchStartTime,
        partialMatching: partialMatchEndTime - partialMatchStartTime,
        averageTimePerField: totalTime / currentSourceFields.length
      }
    });

    return mapping;
  }

  // Функция для определения подходящей функции обработки на основе анализа данных
  const determineProcessingFunction = (targetField, analysis) => {
    // Логируем входные параметры
    logToFile('determineProcessingFunction вызвана', {
      targetField,
      analysis,
      hasAnalysis: !!analysis,
      analysisType: analysis ? typeof analysis : 'undefined'
    });

    // Проверяем входные параметры
    if (!targetField) {
      logToFile('determineProcessingFunction: отсутствует targetField');
      return { function: 'NONE', params: {} };
    }

    if (!analysis || typeof analysis !== 'object') {
      logToFile('determineProcessingFunction: некорректный analysis', { analysis });
      return { function: 'NONE', params: {} };
    }

    // Проверяем наличие всех необходимых свойств
    const requiredProps = ['hasDateTime', 'hasDate', 'hasPhoneNumber', 'hasPrice', 'hasQuantity'];
    const missingProps = requiredProps.filter(prop => !(prop in analysis));
    
    if (missingProps.length > 0) {
      logToFile('determineProcessingFunction: отсутствуют необходимые свойства в analysis', {
        missingProps,
        analysis
      });
      return { function: 'NONE', params: {} };
    }

    // Определяем функцию обработки на основе типа поля и анализа данных
    let result = { function: 'NONE', params: {} };

    switch (targetField) {
      case 'order_date':
      case 'delivery_date':
        if (analysis.hasDateTime) {
          result = { function: 'EXTRACT_DATETIME', params: { format: 'DD.MM.YYYY HH:mm:ss' } };
        } else if (analysis.hasDate) {
          result = { function: 'EXTRACT_DATE', params: { format: 'DD.MM.YYYY' } };
        }
        break;

      case 'telephone':
        if (analysis.hasPhoneNumber) {
          result = { function: 'REGEXP', params: { pattern: '[78]\\d{10}', group: 0 } };
        }
        break;

      case 'revenue':
      case 'cost_price':
        if (analysis.hasPrice) {
          result = { function: 'REGEXP', params: { pattern: '\\d+([.,]\\d{2})?', group: 0 } };
        }
        break;

      case 'quantity':
        if (analysis.hasQuantity) {
          result = { function: 'REGEXP', params: { pattern: '\\d+', group: 0 } };
        }
        break;
    }

    logToFile('determineProcessingFunction результат', {
      targetField,
      result
    });

    return result;
  };

  const fetchMappings = async () => {
    setLoadingMappings(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/field-mappings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setMappings(Array.isArray(data) ? data : [])
    } catch (e) {
      message.error('Ошибка загрузки маппингов')
    } finally {
      setLoadingMappings(false)
    }
  }

  useEffect(() => {
    fetchMappings()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setIsLoadingDetailPane(false);
      // Сбрасываем форму и данные файла, если никакой маппинг не выбран
      form.resetFields();
      setFileData(null);
      setSourceFields([]);
      setCurrentRowIndex(0);
      setOriginalXlsxFileUrl(null); 
      setOriginalXlsxFileName(null);
      setAutoMappingComplete(false);
      logToFile('[useEffect selectedId] selectedId отсутствует. Панель деталей сброшена, isLoadingDetailPane=false');
      return;
    }

    setIsLoadingDetailPane(true);
    logToFile('[useEffect selectedId] Начало обработки selectedId. isLoadingDetailPane=true', { selectedId, mappingsCount: mappings.length });

    if (selectedId === 'new') {
      logToFile('[useEffect selectedId] Выбран новый маппинг');
      form.resetFields();
      setFileData(null);
      setSourceFields([]);
      setCurrentRowIndex(0);
      setOriginalXlsxFileUrl(null); 
      setOriginalXlsxFileName(null);
      setAutoMappingComplete(false); 
      setIsLoadingDetailPane(false);
      logToFile('[useEffect selectedId] Новый маппинг. Форма сброшена, isLoadingDetailPane=false');
    } else {
      const mappingData = mappings.find(m => m.id === selectedId);
      logToFile('[useEffect selectedId] Поиск mappingData для существующего ID', { selectedId, mappingDataFound: !!mappingData });

      if (mappingData) {
        logToFile('[useEffect selectedId] Найден mappingData', { 
          id: mappingData.id, 
          name: mappingData.name, 
          clientId: mappingData.client_id, 
          sample_data_url: mappingData.sample_data_url
        });

        form.setFieldsValue(mappingData); // Устанавливаем поля формы (name, client_id, mapping)
        logToFile('[useEffect selectedId] Форма заполнена из mappingData');
        
        if (mappingData.sample_data_url) {
          logToFile('[useEffect selectedId] Есть sample_data_url, попытка загрузить данные файла', { url: mappingData.sample_data_url });
          setOriginalXlsxFileUrl(mappingData.sample_data_url);
          let s3Key, uiFileName; // uiFileName - для отображения
          try {
            const urlObject = new URL(mappingData.sample_data_url);
            s3Key = urlObject.pathname.split('/').slice(2).join('/'); 
            let tempFileNameFromKey = s3Key.substring(s3Key.lastIndexOf('/') + 1);
            const nameParts = tempFileNameFromKey.split('-');
            // Извлекаем очищенное имя файла из ключа (после UUID)
            if (nameParts.length > 1 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(nameParts[0])) {
                uiFileName = nameParts.slice(1).join('-');
            } else {
                 uiFileName = tempFileNameFromKey; // Если нет UUID, берем как есть (маловероятно для новых)
            }
            // decodeURIComponent здесь НЕ нужен, т.к. имя в ключе уже очищено
            setOriginalXlsxFileName(uiFileName); 
            logToFile('[useEffect selectedId] Извлечены S3 ключ и имя файла для UI', { s3KeyToLoad: s3Key, extractedUiFileName: uiFileName });
            
            loadRemoteXlsxData(mappingData.sample_data_url, s3Key).finally(() => {
              setIsLoadingDetailPane(false);
              logToFile('[useEffect selectedId] Загрузка данных файла (loadRemoteXlsxData) завершена. isLoadingDetailPane=false');
            });
          } catch (error) {
             console.error('Не удалось извлечь ключ/имя файла из URL или ошибка в loadRemoteXlsxData', error);
             logToFile('[useEffect selectedId] Ошибка извлечения ключа/имени файла из sample_data_url или при загрузке', { error: error.message, url: mappingData.sample_data_url });
             // Пытаемся установить имя файла для UI даже при ошибке, если оно было извлечено
             setOriginalXlsxFileName(uiFileName || 'Файл не найден или ошибка имени'); 
             setFileData(null); 
             setSourceFields([]);
             setAutoMappingComplete(false);
             setIsLoadingDetailPane(false); // Убираем скелетон, т.к. загрузка файла не удалась
             logToFile('[useEffect selectedId] Ошибка загрузки файла. isLoadingDetailPane=false');
          }
        } else {
          logToFile('[useEffect selectedId] sample_data_url отсутствует, сброс данных файла.');
          setFileData(null);
          setSourceFields([]);
          setAutoMappingComplete(false);
          setOriginalXlsxFileUrl(null);
          setOriginalXlsxFileName(null);
          setIsLoadingDetailPane(false); // Нет файла для загрузки, убираем скелетон
          logToFile('[useEffect selectedId] Нет sample_data_url. isLoadingDetailPane=false');
        }
      } else {
        logToFile('[useEffect selectedId] mappingData не найден для selectedId, сброс формы и данных файла', { selectedId });
        form.resetFields(); 
        setFileData(null);
        setSourceFields([]);
        setCurrentRowIndex(0);
        setOriginalXlsxFileUrl(null);
        setOriginalXlsxFileName(null);
        setAutoMappingComplete(false);
        setSelectedId(null); // Сбрасываем ID, чтобы не было зависания
        setIsLoadingDetailPane(false); // mappingData не найден, убираем скелетон
        logToFile('[useEffect selectedId] mappingData не найден. isLoadingDetailPane=false');
      }
    }
  }, [selectedId, mappings, form]);

  const handleSelect = (id) => {
    logToFile('Выбран маппинг из списка (handleSelect)', { id });
    setSelectedId(id);
  }

  const handleAdd = () => {
    setSelectedId('new');
  }
  
  const handleCancel = () => {
    setSelectedId(null);
  };

  const handleSubmit = async (values) => {
    // Перед непосредственным сабмитом, вызовем isMappingValid с показом сообщений
    if (!isMappingValid(true)) {
      // Сообщения об ошибках уже будут показаны внутри isMappingValid, если showMessages = true
      // Можно добавить общее сообщение, если нужно
      // message.error('Пожалуйста, исправьте ошибки в форме перед сохранением.');
      await logToFile('❌ Попытка сохранения невалидного маппинга. Ошибки показаны пользователю.', { values });
      return; 
    }

    try {
      await logToFile('Начало сохранения маппинга', {
        values,
        selectedId,
        hasClientId: !!values.client_id,
        hasName: !!values.name,
        hasMapping: !!values.mapping,
        mappingKeys: values.mapping ? Object.keys(values.mapping) : []
      });

      if (!values.client_id) {
        await logToFile('❌ Ошибка: client_id отсутствует');
        message.error('Пожалуйста, выберите клиента');
        return;
      }

      const token = localStorage.getItem('token')
      let res;
      let method;
      let url;

      const formattedMapping = {};
      // Изменяем логику формирования mapping: теперь включаем ВСЕ целевые поля
      Object.keys(targetFieldMappings).forEach(targetFieldKey => {
          const fieldMapping = values.mapping?.[targetFieldKey];
          formattedMapping[targetFieldKey] = {
              field: fieldMapping?.field || null, // Устанавливаем null, если поле не выбрано
              processing: fieldMapping?.processing || { function: 'NONE', params: {} } // Сохраняем обработку, если есть, или NONE
          };
      });

      await logToFile('Форматированный маппинг', {
        original: values.mapping,
        formatted: formattedMapping,
        fieldsCount: Object.keys(formattedMapping).length
      });

      const payload = {
        name: values.name.trim(),
        client_id: values.client_id,
        mapping: formattedMapping,
        sample_data_url: originalXlsxFileUrl
      };

      await logToFile('Подготовленные данные для отправки', {
        payload,
        selectedId,
        method: selectedId === 'new' ? 'POST' : 'PUT'
      });

      if (selectedId === 'new') {
        method = 'POST';
        url = `${API_URL}/api/field-mappings`;
      } else {
        method = 'PUT';
        url = `${API_URL}/api/field-mappings/${selectedId}`;
      }
      
      res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      await logToFile('Ответ сервера при попытке сохранения', {
        status: res.status,
        ok: res.ok,
        data
      });

      if (!res.ok) throw new Error(data.message || 'Ошибка сервера');
      
      message.success(selectedId === 'new' ? 'Маппинг успешно создан' : 'Маппинг успешно обновлен');
      fetchMappings();
      setSelectedId(null);
      setOriginalXlsxFileUrl(null);
      setOriginalXlsxFileName(null);
    } catch (e) {
      await logToFile('❌ Ошибка при сохранении маппинга', {
        error: e.message,
        stack: e.stack
      });
      message.error(e.message || 'Ошибка сохранения маппинга');
      console.error("Submit error:", e);
    }
  }

  const handleDeleteMapping = async () => {
    if (!selectedId || selectedId === 'new') return;
    if (!window.confirm('Вы уверены, что хотите удалить этот маппинг?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/field-mappings/${selectedId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Ошибка удаления маппинга' }));
        throw new Error(errorData.message);
      }
      message.success('Маппинг успешно удален');
      fetchMappings();
      setSelectedId(null);
    } catch (e) {
      message.error(e.message || 'Не удалось удалить маппинг.');
    }
  };

  const handleFileUpload = async (file) => {
    try {
      setLoading(true);
      setUploadProgress(0);
      setProcessingFile(false);
      setAutoMappingComplete(false);
      setOriginalXlsxFileUrl(null);
      setOriginalXlsxFileName(null);

      await logToFile('📤 Начало загрузки файла', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/field-mappings/upload-xlsx`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        await logToFile('❌ Ошибка загрузки файла', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.message || 'Ошибка загрузки файла');
      }

      const data = await response.json();
      
      // Сохраняем URL оригинального файла, если он есть
      if (data.signedOriginalFileUrl) {
        setOriginalXlsxFileUrl(data.signedOriginalFileUrl);
      }
      if (data.originalFileName) {
        // data.originalFileName от uploadXLSX - это "красивое" имя
        setOriginalXlsxFileName(data.originalFileName);
      } else if (data.originalFileKey) { 
        // Запасной вариант, если originalFileName отсутствует, извлекаем из ключа (будет очищенное)
        let fallbackName = data.originalFileKey.substring(data.originalFileKey.lastIndexOf('/') + 1);
        const parts = fallbackName.split('-');
        if (parts.length > 1 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(parts[0])) {
          fallbackName = parts.slice(1).join('-');
        }
        // decodeURIComponent здесь не нужен
        setOriginalXlsxFileName(fallbackName); 
      }
      
      await logToFile('📊 Начало фильтрации строк', {
        totalRows: data.rows?.length || 0,
        fields: data.fields,
        hasData: !!data,
        dataKeys: Object.keys(data)
      });
      
      if (!data.rows || !data.fields) {
        await logToFile('❌ Некорректные данные от сервера', { data });
        throw new Error('Некорректный формат данных от сервера');
      }
      
      // Фильтруем строки, где есть данные только в первом столбце
      const filteredRows = data.rows.filter(row => {
        // Получаем все значения кроме первого столбца
        const otherColumns = Object.values(row).slice(1);
        // Проверяем, есть ли хотя бы одно непустое значение в других столбцах
        return otherColumns.some(value => value !== null && value !== undefined && value !== '');
      });

      // Сначала устанавливаем все данные
      setSourceFields(data.fields);
      setFileData(filteredRows);
      setTotalRows(data.totalRows || filteredRows.length);
      setPreviewRows(filteredRows.length);
      setCurrentRowIndex(0);

      // Даем React обновить состояние перед продолжением
      await new Promise(resolve => setTimeout(resolve, 0));

      // Теперь запускаем автоматическое сопоставление полей
      if (data.fields.length && filteredRows.length) {
        setProcessingFile(true);
        const autoMappedFields = await autoMapFields(data.fields);
        
        // Преобразуем результаты автомаппинга в формат для формы
        const formattedMapping = {};
        Object.entries(autoMappedFields).forEach(([key, value]) => {
          formattedMapping[key] = {
            field: value.field,
            processing: value.processing
          };
        });
        
        form.setFieldsValue({ mapping: formattedMapping });
        setAutoMappingComplete(true);
      } else {
        await logToFile('⚠️ Нет данных для обработки', {
          fieldsLength: data.fields.length,
          rowsLength: filteredRows.length
        });
        message.warning('Файл не содержит данных для обработки');
      }

      message.success('Файл успешно загружен и обработан');
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      await logToFile('❌ Ошибка при загрузке файла', {
        error: error.message,
        stack: error.stack
      });
      message.error(error.message || 'Общая ошибка при обработке файла.');
      setFileData(null);
      setSourceFields([]);
      setAutoMappingComplete(false);
    } finally {
      setLoading(false);
      setUploadProgress(100);
      setProcessingFile(false);
    }
    return false;
  };

  // handleRemoveLogo не относится к этому компоненту.

  const currentMappingData = selectedId && selectedId !== 'new' ? mappings.find(m => m.id === selectedId) : null;

  // Загрузка списка клиентов
  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Ошибка загрузки списка клиентов');
      
      const data = await response.json();
      setClients(data);
    } catch (error) {
      message.error('Не удалось загрузить список клиентов');
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  // Загружаем клиентов при монтировании
  useEffect(() => {
    fetchClients();
  }, []);

  // Функция для загрузки и обработки XLSX из S3
  const loadRemoteXlsxData = async (s3FullUrl, s3Key) => {
    if (!s3Key) {
      logToFile('[loadRemoteXlsxData] Ошибка: ключ S3 не предоставлен.', { s3FullUrl });
      return;
    }

    logToFile('[loadRemoteXlsxData] Начало загрузки данных файла из S3', { s3Key });
    setLoadingFileData(true);
    setFileData(null); // Сбрасываем предыдущие данные
    setSourceFields([]);
    setAutoMappingComplete(false);
    setCurrentRowIndex(0);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/field-mappings/process-s3-xlsx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ s3Key })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logToFile('[loadRemoteXlsxData] ❌ Ошибка от API при обработке файла S3', {
          status: response.status,
          error: errorData,
          s3Key
        });
        message.error(errorData.message || 'Ошибка загрузки данных файла из S3');
        throw new Error(errorData.message || 'Ошибка загрузки данных файла из S3');
      }

      const data = await response.json();
      logToFile('[loadRemoteXlsxData] Данные файла из S3 успешно получены и обработаны (сырые от API)', {
        fieldsCount: data.fields?.length,
        rowsCountInResponse: data.rows?.length, // Это previewRows с бэкенда
        totalRowsFromApi: data.totalRows,
        previewRowsFromApi: data.previewRows,
        originalFileNameFromApi: data.originalFileName,
        firstRowExample: data.rows ? data.rows[0] : 'no rows'
      });

      if (!data.rows || !data.fields) {
        logToFile('[loadRemoteXlsxData] ❌ Некорректные данные от сервера (process-s3-xlsx)', { data });
        throw new Error('Некорректный формат данных файла от сервера');
      }
      
      // Фильтрация строк теперь выполняется на бэкенде.
      // const processedRows = data.rows; // Просто используем data.rows

      setSourceFields(data.fields);
      setFileData(data.rows); // Используем data.rows напрямую
      setTotalRows(data.totalRows); 
      setPreviewRows(data.previewRows);
      setCurrentRowIndex(0);
      setAutoMappingComplete(true); 
      
      // Обновляем имя файла, если оно пришло с бэка и отличается 
      // data.originalFileName от processS3XLSX - это очищенное имя из ключа
      if (data.originalFileName) {
        setOriginalXlsxFileName(data.originalFileName);
      }
      message.success('Данные из исходного файла успешно загружены.');

    } catch (error) {
      console.error('Error in loadRemoteXlsxData:', error);
      logToFile('[loadRemoteXlsxData] ❌ Ошибка при загрузке/обработке данных файла из S3', {
        errorMessage: error.message,
        s3Key
      });
      message.error(error.message || 'Ошибка загрузки данных исходного файла.');
      // Сбрасываем состояния, связанные с файлом, если загрузка не удалась
      setFileData(null);
      setSourceFields([]);
      setAutoMappingComplete(false);
    } finally {
      setLoadingFileData(false);
    }
  };

  return (
    <div className="list-detail-layout" style={{ height: '100%' }}>
      <div className="list-container">
        <div className="list-header">
          <Title level={4} style={{ margin: 0, flex: 1 }}>Правила маппинга</Title>
          <Button className="add-list-item-button" type="primary" size="small" onClick={handleAdd}>
            Добавить
          </Button>
        </div>
        <Input.Search
          placeholder="Поиск по названию или компании"
          allowClear
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ margin: '16px 0', width: '100%' }}
        />
        <div className="list-scroll-area">
          {loadingMappings && <Skeleton active paragraph={{ rows: 8 }} />}
          {!loadingMappings && filteredMappings.length === 0 && (
            <Empty 
              description={searchText ? "Ничего не найдено" : "Правила маппинга отсутствуют. Нажмите 'Добавить', чтобы создать первое."} 
              style={{marginTop: '30px'}}
            />
          )}
          {!loadingMappings && filteredMappings.map(mapping => {
            // Форматируем дату создания
            let formattedDate = 'Нет даты';
            // Sequelize может возвращать createdAt или created_at в зависимости от конфигурации
            const createdAtTimestamp = mapping.createdAt || mapping.created_at;
            if (createdAtTimestamp) {
              try {
                const date = new Date(createdAtTimestamp);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
                const year = String(date.getFullYear()).slice(-2); // Последние 2 цифры года
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                formattedDate = `${day}.${month}.${year} ${hours}:${minutes}`;
              } catch (e) {
                console.error('Ошибка форматирования даты:', e, 'для значения:', createdAtTimestamp);
                formattedDate = 'Ошибка даты';
              }
            }

            return (
              <div
                key={mapping.id}
                onClick={() => handleSelect(mapping.id)}
                className={`list-item mapping-list-item ${selectedId === mapping.id ? 'selected' : ''}`}
              >
                <div className="list-item-content-wrapper">
                  <span className="list-item-line1">{mapping.name}</span>
                  {/* Контейнер для клиента и даты */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography.Text className="list-item-line2" style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mapping.client?.name || 'Без клиента'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', marginLeft: '8px', fontSize: '12px' }}>
                      {formattedDate}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="detail-pane">
        {!selectedId ? (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined />
            <p>Выберите правило маппинга из списка слева для просмотра или редактирования, или нажмите «Добавить» для создания нового.</p>
          </div>
        ) : isLoadingDetailPane ? (
          <Skeleton active paragraph={{ rows: 15 }} style={{ padding: '24px' }} />
        ) : (
          <>
            <div style={{ 
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <Title level={4} style={{ margin: 0 }}>
                {selectedId === 'new' 
                  ? 'Новое правило маппинга' 
                  : `Правило: ${mappings.find(m => m.id === selectedId)?.name || ''}`}
              </Title>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              size="small"
              style={{ 
                padding: '24px',
                height: 'calc(100% - 72px)',
                overflowY: 'auto'
              }}
            >
              <Form.Item
                name="client_id"
                label="Клиент"
                rules={[{ required: true, message: 'Выберите клиента' }]}
                className="form-item-spacing"
              >
                <Select
                  placeholder="Выберите клиента"
                  loading={loadingClients}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  style={{ width: '100%' }}
                >
                  {clients.map(client => (
                    <Select.Option key={client.id} value={client.id}>
                      {client.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="name"
                label="Название маппинга"
                rules={[{ required: true, message: 'Введите название маппинга' }]}
                className="form-item-spacing"
              >
                <Input placeholder="Введите название для сохранения маппинга" />
              </Form.Item>

              {/* Унифицированный блок для загрузки файла или отображения информации о нем */}
              {(!fileData && !originalXlsxFileUrl) ? (
                // Если нет fileData (данных в памяти) И нет originalXlsxFileUrl (для существующего маппинга)
                // показываем загрузчик
                <Form.Item className="form-item-spacing" style={{ marginBottom: 0 }}> 
                  <Upload.Dragger
                    beforeUpload={handleFileUpload}
                    accept=".xlsx,.xls"
                    maxCount={1}
                    showUploadList={false}
                    disabled={loading} // loading - общее состояние загрузки от handleFileUpload
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <UploadOutlined style={{ fontSize: '24px', color: '#40a9ff' }} />
                      <p style={{ margin: 0, fontSize: '14px' }}>
                        {loading ? (processingFile ? 'Выполняется автоматическое сопоставление полей...' : 'Загрузка файла...') : 'Нажмите или перетащите файл XLSX'}
                      </p>
                      {loading && (
                        <Progress 
                          percent={processingFile ? 99 : uploadProgress} 
                          status={processingFile ? "active" : (uploadProgress === 100 ? "success" : "active")}
                          size="small"
                          style={{ padding: '0 24px' }}
                        />
                      )}
                      {!loading && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                          Поддерживаются файлы Excel (.xlsx, .xls)
                        </p>
                      )}
                    </Space>
                  </Upload.Dragger>
                </Form.Item>
              ) : (
                // Иначе (есть fileData или originalXlsxFileUrl) показываем карточку с информацией о файле
                <Card size="small" className="form-item-spacing" title={fileData ? "Загруженный файл" : "Исходный файл"}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {originalXlsxFileName && (
                      <div>
                        <Typography.Text type="secondary">Файл: </Typography.Text>
                        <Typography.Text>{originalXlsxFileName}</Typography.Text>
                      </div>
                    )}
                    
                    {loadingFileData && (
                      <Space align="center">
                        <Progress percent={50} status="active" size="small" style={{width: '150px'}} showInfo={false}/> 
                        <Typography.Text type="secondary" style={{marginLeft: 8}}>Загрузка данных...</Typography.Text>
                      </Space>
                    )}

                    {(fileData && !loadingFileData) && (
                      <>
                        <div>
                          <Typography.Text type="secondary">Всего строк в файле: </Typography.Text>
                          <Typography.Text>{totalRows}</Typography.Text>
                        </div>
                        <div>
                          <Typography.Text type="secondary">Строк для предпросмотра: </Typography.Text>
                          <Typography.Text>{previewRows}</Typography.Text>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Space size={8} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space size={8}>
                              <Button 
                                size="small" 
                                onClick={() => setCurrentRowIndex(prev => Math.max(0, prev - 1))}
                                disabled={currentRowIndex === 0}
                              >
                                <LeftOutlined />
                              </Button>
                              <Typography.Text>
                                Строка {previewRows > 0 ? currentRowIndex + 1 : 0} из {previewRows}
                              </Typography.Text>
                              <Button 
                                size="small" 
                                onClick={() => setCurrentRowIndex(prev => Math.min(previewRows - 1, prev + 1))}
                                disabled={previewRows === 0 || currentRowIndex === previewRows - 1}
                              >
                                <RightOutlined />
                              </Button>
                            </Space>
                            {selectedId === 'new' && fileData && ( // Кнопка "Удалить" только для нового маппинга и если есть fileData
                              <Button 
                                type="link" 
                                danger 
                                onClick={() => {
                                  setFileData(null);
                                  setSourceFields([]);
                                  setCurrentRowIndex(0);
                                  setOriginalXlsxFileUrl(null); // Также сбрасываем URL, если он был от загрузки
                                  setOriginalXlsxFileName(null);
                                  form.resetFields([
                                    'mapping'
                                    // Не сбрасываем client_id и name, если они уже введены для нового маппинга
                                  ]);
                                  setAutoMappingComplete(false);
                                }}
                              >
                                Удалить файл
                              </Button>
                            )}
                          </Space>
                        </div>
                        {processingFile && (
                          <Alert
                            message="Выполняется автоматическое сопоставление полей..."
                            type="info"
                            showIcon
                          />
                        )}
                      </>
                    )}

                    {originalXlsxFileUrl && (
                       <div>
                        <Typography.Text type="secondary">Ссылка: </Typography.Text>
                        <Button 
                          type="link" 
                          icon={<LinkOutlined />}
                          onClick={async () => {
                            if (selectedId === 'new' || !currentMappingData?.sample_data_url) { // Если это новый маппинг (URL уже подписан) или нет sample_data_url
                              window.open(originalXlsxFileUrl, '_blank');
                            } else {
                              // Для существующего маппинга нужно получить свежую подписанную ссылку
                              // currentMappingData.sample_data_url здесь это КЛЮЧ S3
                              try {
                                message.loading({ content: 'Получение ссылки...', key: 'gettingSignedUrl' });
                                
                                console.log('[FieldMappingPage] Initial currentMappingData.sample_data_url:', currentMappingData?.sample_data_url);
                                let s3Key = currentMappingData.sample_data_url;
                                
                                if (s3Key) {
                                  const bucketName = import.meta.env.VITE_S3_BUCKET_NAME; // Объявляем bucketName один раз здесь

                                  // 1. Если это полный URL, извлекаем путь
                                  if (s3Key.startsWith('http')) {
                                    try {
                                      const urlObject = new URL(s3Key);
                                      s3Key = urlObject.pathname; // Получаем путь, например /5star-bucket/path/key.xlsx
                                    } catch (e) {
                                      console.error('[FieldMappingPage] Error parsing sample_data_url as URL:', s3Key, e);
                                    }
                                  }

                                  // 2. Убираем query-параметры (из исходной строки, если это не был URL, или из pathname)
                                  s3Key = s3Key.split('?')[0];

                                  // 3. Убираем ведущий слэш, если он есть
                                  if (s3Key.startsWith('/')) {
                                    s3Key = s3Key.substring(1);
                                  }

                                  // 4. Удаляем имя бакета, если оно является первой частью пути
                                  if (bucketName && s3Key.startsWith(bucketName + '/')) {
                                    s3Key = s3Key.substring(bucketName.length + 1);
                                  } else if (!bucketName && s3Key.includes('/')) {
                                    // Если VITE_S3_BUCKET_NAME не задан, но ключ все еще содержит '/',
                                    // пробуем удалить первую часть как предполагаемое имя бакета.
                                    s3Key = s3Key.substring(s3Key.indexOf('/') + 1);
                                  }
                                }

                                console.log('[FieldMappingPage] Attempting to get signed URL for S3 Key (final cleanup):', s3Key);
                                // Формируем URL для логирования, чтобы увидеть, на что реально пойдет запрос в api.js
                                // Это только для отладки, сам URL формируется внутри apiClient
                                const debugUrl = `${API_URL}/api/field-mappings/s3-signed-url?key=${encodeURIComponent(s3Key)}`;
                                console.log('[FieldMappingPage] Debug URL for getSignedUrl:', debugUrl);

                                const signedUrlResponse = await apiClient.getSignedUrlForFile(s3Key);
                                if (signedUrlResponse && signedUrlResponse.signedUrl) {
                                  message.success({ content: 'Ссылка получена!', key: 'gettingSignedUrl', duration: 2 });
                                  window.open(signedUrlResponse.signedUrl, '_blank');
                                } else {
                                  message.error({ content: 'Не удалось получить ссылку или ответ не содержит URL.', key: 'gettingSignedUrl', duration: 2 });
                                }
                              } catch (error) {
                                message.error({ content: `Ошибка получения ссылки: ${error.message}`, key: 'gettingSignedUrl', duration: 3 });
                              }
                            }
                          }}
                          style={{ paddingLeft: 0 }}
                        >
                          Открыть XLSX
                        </Button>
                      </div>
                    )}
                  </Space>
                </Card>
              )}

              <Divider style={{ margin: '8px 0' }} />

              {(() => {
                // Условие отображения полей маппинга:
                // 1. Есть fileData (данные загружены в память, неважно новый или существующий маппинг)
                // ИЛИ
                // 2. Для существующего маппинга (selectedId !== 'new'), есть originalXlsxFileUrl (т.е. файл привязан)
                //    и при этом ЕСТЬ загруженные значения в form.getFieldValue('mapping')
                //    Это нужно, чтобы при открытии старого маппинга, где файл ЕСТЬ, но данные файла ЕЩЕ НЕ загрузились (fileData=null),
                //    но значения маппинга УЖЕ установлены в форму из mappingData, поля отобразились.
                //    И при этом autoMappingComplete не обязателен, т.к. маппинг уже сохранен.
                
                const formMappingValues = form.getFieldValue('mapping');
                const hasExistingMappingValuesInForm = selectedId !== 'new' && originalXlsxFileUrl && formMappingValues && Object.keys(formMappingValues).length > 0;

                const shouldShow = (fileData && sourceFields.length > 0) || hasExistingMappingValuesInForm;
                
                logToFile('[Render Mappings Check]', { 
                  shouldShow,
                  hasFileData: !!fileData,
                  sourceFieldsLength: sourceFields?.length || 0,
                  hasOriginalXlsxFileUrl: !!originalXlsxFileUrl,
                  selectedId,
                  hasExistingMappingValuesInForm,
                  formMappingValuesKeys: formMappingValues ? Object.keys(formMappingValues).length : 0,
                  autoMappingComplete // autoMappingComplete теперь больше для индикации процесса, а не для отображения
                });
                return shouldShow;
              })() && (
                <div style={{ marginTop: '16px' }}>
                  {Object.entries(targetFieldMappings).map(([fieldKey, fieldInfo]) => (
                    <MappingField
                      key={fieldKey}
                      fieldKey={fieldKey}
                      fieldInfo={fieldInfo}
                      form={form}
                      sourceFields={sourceFields}
                      fileData={fileData}
                      currentRowIndex={currentRowIndex}
                    />
                  ))}
                </div>
              )}

              <div className="form-footer">
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    disabled={!isValid}
                  >
                    {selectedId === 'new' ? 'Сохранить маппинг' : 'Обновить маппинг'}
                  </Button>
                  <Button onClick={handleCancel}>
                    Отмена
                  </Button>
                </Space>
                {selectedId && selectedId !== 'new' && currentMappingData && (
                  <Button 
                    danger 
                    onClick={handleDeleteMapping}
                    // icon={<DeleteOutlined />} // Иконка удалена
                  >
                    Удалить
                  </Button>
                )}
              </div>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}

export default FieldMappingPage; 