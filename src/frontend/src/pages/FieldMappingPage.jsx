import React, { useState, useEffect } from 'react';
import { Button, Typography, Form, Input, message, Select, Skeleton, Upload, Progress, Empty, Space } from 'antd';
import { InfoCircleOutlined, UploadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { API_URL } from '../constants/appConstants';
import { requiredFields, targetFieldMappings } from '../constants/fieldMappingConstants';

const { Title, Paragraph } = Typography;

// Код функции FieldMappingPage из App.jsx (строки ~410-963) будет здесь
function FieldMappingPage() {
  const [fileData, setFileData] = useState(null)
  const [sourceFields, setSourceFields] = useState([])
  const [currentRowIndex, setCurrentRowIndex] = useState(0)
  const [loading, setLoading] = useState(false) // Это loading для XLSX файла
  const [uploadProgress, setUploadProgress] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [previewRows, setPreviewRows] = useState(0)
  const [processingFile, setProcessingFile] = useState(false)
  const [mappings, setMappings] = useState([])
  const [loadingMappings, setLoadingMappings] = useState(false) // Это для списка маппингов
  const [form] = Form.useForm()
  const [selectedId, setSelectedId] = useState(null); // null | mapping.id | 'new'

  const isMappingValid = () => {
    const currentFormValues = form.getFieldsValue();
    if (!currentFormValues.name || currentFormValues.name.trim() === '') {
      return false;
    }
    const currentMappingObject = currentFormValues.mapping || {};
    const hasAllRequiredTargetFields = requiredFields.every(field => 
      currentMappingObject[field] && currentMappingObject[field].trim() !== ''
    );
    if (!hasAllRequiredTargetFields) {
      return false;
    }
    return true;
  }

  const logToFile = async (messageText, data = null) => { // переименовал message в messageText во избежание конфликта с message из antd
    try {
      const timestamp = new Date().toISOString();
      let logMessage = `\n[${timestamp}] ${messageText}`;
      if (data) {
        logMessage += '\n' + JSON.stringify(data, null, 2);
      }
      
      const response = await fetch('/api/debug-log', { // TODO: Заменить на API_URL если это предполагается
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: logMessage }) // здесь параметр message, как ожидает бэкенд
      });
      
      if (!response.ok) {
        console.error('Failed to write to log file');
      }
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  };

  const autoMapFields = async (currentSourceFields) => { // переименовал sourceFields
    await logToFile('🔍 НАЧАЛО АВТОМАТИЧЕСКОГО СОПОСТАВЛЕНИЯ ПОЛЕЙ 🔍');
    await logToFile('Исходные поля:', currentSourceFields);

    const normalizeField = (field) => {
      const normalized = field.toLowerCase()
        .replace(/[_\-\.()№]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return normalized;
    }

    await logToFile('📌 ЭТАП 1: Проверка прямых соответствий');
    
    const mapping = {};
    const usedSourceFields = new Set();

    for (const sourceField of currentSourceFields) {
      const normalizedSource = normalizeField(sourceField);
      await logToFile(`Проверяем поле: "${sourceField}"`, { normalized: normalizedSource });
      
      switch(normalizedSource) {
        case 'заказа':
        case '№ заказа':
          mapping['order_number'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с order_number');
          break;
        // ... (остальные case из autoMapFields) ...
        case 'дата оформления':
          mapping['order_date'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с order_date');
          break;
        case 'дата выдачи заказа':
          mapping['delivery_date'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с delivery_date');
          break;
        case 'бренд':
          mapping['brand'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с brand');
          break;
        case 'артикул':
          mapping['article_number'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с article_number');
          break;
        case 'товар':
          mapping['product'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с product');
          break;
        case 'количество':
          mapping['quantity'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с quantity');
          break;
        case 'розница сумма':
        case 'розница (сумма)':
          mapping['revenue'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с revenue');
          break;
        case 'телефон':
          mapping['telephone'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с telephone');
          break;
        case 'имя':
          mapping['name'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с name');
          break;
        case 'фамилия':
          mapping['last_name'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с last_name');
          break;
        case 'car brand':
        case 'car_brand':
          mapping['car_brand'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с car_brand');
          break;
        case 'car model':
        case 'car_model':
          mapping['car_model'] = sourceField;
          usedSourceFields.add(sourceField);
          await logToFile('✅ Сопоставлено с car_model');
          break;
        default:
          await logToFile('❌ Не найдено прямых соответствий');
      }
    }

    await logToFile('📊 ИТОГОВЫЙ РЕЗУЛЬТАТ', {
      mapping,
      usedSourceFields: Array.from(usedSourceFields),
      unmappedFields: currentSourceFields.filter(f => !usedSourceFields.has(f))
    });

    return mapping;
  }

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
    if (selectedId === 'new') {
      form.resetFields();
      setFileData(null);
      setSourceFields([]);
      setCurrentRowIndex(0);
    } else if (selectedId) {
      const mappingData = mappings.find(m => m.id === selectedId);
      if (mappingData) {
        form.setFieldsValue(mappingData);
      } else {
        setSelectedId(null);
        form.resetFields();
      }
      setFileData(null);
      setSourceFields([]);
      setCurrentRowIndex(0);
    } else {
      form.resetFields();
      setFileData(null);
      setSourceFields([]);
      setCurrentRowIndex(0);
    }
  }, [selectedId, mappings, form]);

  const handleSelect = (id) => {
    setSelectedId(id);
  }

  const handleAdd = () => {
    setSelectedId('new');
  }
  
  const handleCancel = () => {
    setSelectedId(null);
  };

  const handleSubmit = async (values) => {
    try {
      const token = localStorage.getItem('token')
      let res;
      let method;
      let url;

      const payload = {
        name: values.name,
        mapping: values.mapping || {}
      };

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
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Ошибка сервера');
      
      message.success(selectedId === 'new' ? 'Маппинг успешно создан' : 'Маппинг успешно обновлен');
      fetchMappings();
      setSelectedId(null);
    } catch (e) {
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
    // Эта функция загрузки не для логотипа, а для XLSX файла.
    // Логика из ClientsPage/UsersPage для лого не подходит.
    // Здесь должна быть логика чтения XLSX и вызова autoMapFields.
    // Текущая функция handleFileUpload в App.jsx для FieldMappingPage выглядит неполной.
    // Я оставлю ее как есть в App.jsx, но укажу на этот момент.
    // setIsUploadingLogo(true); // Этой переменной нет
    message.info('Функция загрузки файла для XLSX еще не реализована до конца в этом компоненте.');
    // Пример изначальной логики (если была):
    // setLoading(true); setUploadProgress(0); setProcessingFile(false);
    // const reader = new FileReader();
    // reader.onprogress = (event) => { ... setUploadProgress ... }
    // reader.onload = async (e) => { ... setProcessingFile(true) ... setSourceFields ... autoMapFields ... }
    // reader.readAsArrayBuffer(file);
    return false; // Предотвращаем стандартную загрузку antd
  };

  // handleRemoveLogo не относится к этому компоненту.

  const currentMappingData = selectedId && selectedId !== 'new' ? mappings.find(m => m.id === selectedId) : null;

  return (
    <div className="list-detail-layout">
      <div 
        className="list-container"
        style={{ 
          // width: '320px',
          // minWidth: '320px'
        }}
      >
        <div className="list-header">
          <Title level={4} style={{ margin: 0, flex: 1 }}>Профили маппинга</Title>
          <Button className="add-list-item-button" type="primary" size="small" onClick={handleAdd}>
            Добавить
          </Button>
        </div>
        {loadingMappings && mappings.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : mappings.length > 0 ? (
          <div className="list-scroll-area">
            {mappings.map(m => (
              <div
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`list-item mapping-list-item ${selectedId === m.id ? 'selected' : ''}`}
              >
                <div className="list-item-content-wrapper">
                  <span className="list-item-line1">{m.name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="Профили маппинга отсутствуют." style={{ marginTop: '30px' }} />
        )}
      </div>

      <div className="detail-pane">
        {selectedId ? (
          <>
            <Title level={4} style={{ paddingTop: '16px', marginBottom: '24px', paddingLeft: '24px' }}>
              {selectedId === 'new' 
                ? 'Новый маппинг' 
                : (currentMappingData ? `Редактирование маппинга: ${currentMappingData.name}` : 'Загрузка...')}
            </Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              size="small"
              style={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                paddingRight: '10px',
                display: 'flex',
                flexDirection: 'column'
              }} 
              className="custom-scroll-list"
            >
              <div style={{ flexGrow: 1, overflowY: 'auto' }} className="custom-scroll-list">
              <Form.Item
                name="name"
                label="Название маппинга"
                rules={[{ required: true, message: 'Введите название маппинга' }]}
                style={{ marginBottom: 24 }}
              >
                <Input placeholder="Введите название для сохранения маппинга" />
              </Form.Item>

              <Upload.Dragger
                beforeUpload={handleFileUpload}
                accept=".xlsx,.xls"
                maxCount={1}
                showUploadList={false}
                disabled={loading}
                style={{ marginBottom: '24px' }}
              >
                <p className="ant-upload-drag-icon" style={{ marginBottom: '4px' }}>
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text" style={{ marginBottom: '4px', fontSize: '14px' }}>
                  {loading ? (processingFile ? 'Обработка файла...' : 'Загрузка файла...') : 'Нажмите или перетащите файл XLSX для загрузки'}
                </p>
                {loading && (
                  <div style={{ marginTop: 4, padding: '0 32px' }}>
                    <Progress 
                      percent={processingFile ? 99 : uploadProgress} 
                      status={processingFile ? "active" : (uploadProgress === 100 ? "success" : "active")}
                      size="small"
                    />
                  </div>
                )}
                <p className="ant-upload-hint" style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>
                  Поддерживаются файлы Excel (.xlsx, .xls) размером до 20MB
                </p>
              </Upload.Dragger>

              {fileData && (
                <>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '12px',
                    background: '#fafafa',
                    borderRadius: '6px',
                    marginBottom: '24px'
                  }}>
                    <Button 
                      icon={<LeftOutlined />} 
                      onClick={() => setCurrentRowIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentRowIndex === 0}
                      size="small"
                    />
                    <span style={{ flex: 1, textAlign: 'center' }}>
                      Запись {currentRowIndex + 1} из {previewRows}
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        Всего строк в файле: {totalRows}
                      </div>
                    </span>
                    <Button 
                      icon={<RightOutlined />} 
                      onClick={() => setCurrentRowIndex(prev => Math.min(previewRows - 1, prev + 1))}
                      disabled={currentRowIndex >= previewRows - 1}
                      size="small"
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    {Object.entries(targetFieldMappings).map(([fieldKey, fieldInfo]) => (
                      <Form.Item
                        key={fieldKey}
                        label={fieldInfo.name}
                        name={['mapping', fieldKey]}
                        rules={[
                          { 
                            required: requiredFields.includes(fieldKey),
                            message: `Пожалуйста, выберите поле для "${fieldInfo.name}"` 
                          }
                        ]}
                      >
                        <Select
                          placeholder={`Выберите поле для "${fieldInfo.name}"`}
                          allowClear
                        >
                          {sourceFields.map(field => (
                            <Select.Option key={field} value={field}>
                              {field}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    ))}
                  </div>
                </>
              )}
              </div>
              
              <Form.Item 
                style={{ 
                  paddingTop: '16px', 
                  borderTop: '1px solid #f0f0f0',
                  marginTop: 'auto',
                  marginBottom: 0
                }}
              >
                <Space style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                  <div>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    disabled={!isMappingValid()}
                    style={{marginRight: '8px'}}
                  >
                      {selectedId === 'new' ? 'Сохранить маппинг' : 'Обновить маппинг'}
                  </Button>
                    <Button onClick={handleCancel}>
                    Отмена
                  </Button>
                  </div>
                  {selectedId && selectedId !== 'new' && currentMappingData && (
                    <Button 
                      danger 
                      onClick={handleDeleteMapping}
                    >
                      Удалить
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </>
        ) : mappings.length > 0 && !loadingMappings ? (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined />
            <p>Выберите профиль маппинга из списка для просмотра или редактирования, или нажмите «Добавить» для создания нового.</p>
          </div>
        ) : (
          !loadingMappings && mappings.length === 0 ? (
             <Empty description="Создайте свой первый профиль маппинга, нажав кнопку 'Добавить'." style={{ marginTop: '60px'}}/>
          ) : null
        )}
      </div>
    </div>
  )
}

export default FieldMappingPage; 