import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Form, Input, Select, Skeleton, Upload, Space, Empty, App } from 'antd';
import { InfoCircleOutlined, UploadOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/constants/appConstants';

const { Title, Paragraph } = Typography;

function ClientsPage() {
  const { message: appMessage } = App.useApp();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // null | number (id) | 'new'
  const [form] = Form.useForm();
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [shouldRemoveLogo, setShouldRemoveLogo] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clients`);
      if (!res.ok) throw new Error('Ошибка загрузки клиентов');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      appMessage.error(e.message || 'Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [appMessage]);

  const selectedClientData = selectedId && selectedId !== 'new' ? clients.find(c => c.id === selectedId) : null;

  useEffect(() => {
    if (selectedId === 'new') {
      form.resetFields();
      setLogoPreview(null);
      setSelectedLogoFile(null);
      setShouldRemoveLogo(false);
      form.setFieldsValue({ logoFile: [] });
    } else if (selectedClientData) {
      form.setFieldsValue({ name: selectedClientData.name });
      if (selectedClientData.logo_url && typeof selectedClientData.logo_url === 'string' && selectedClientData.logo_url.trim() !== '') {
        const logoUrl = selectedClientData.logo_url.trim();
        setLogoPreview(logoUrl);

        const fileName = logoUrl.substring(logoUrl.lastIndexOf('/') + 1) || 'logo.png';
        const fileUid = `client-${selectedClientData.id}-${fileName}-${Date.now()}`;

        const existingLogo = [{
          uid: fileUid,
          name: fileName,
          status: 'done',
          url: logoUrl,
          thumbUrl: logoUrl,
        }];
        
        form.setFieldsValue({ logoFile: existingLogo });
      } else {
        setLogoPreview(null);
        form.setFieldsValue({ logoFile: [] });
      }
      setSelectedLogoFile(null);
      setShouldRemoveLogo(false);
    } else if (!selectedId) {
      form.resetFields();
      setLogoPreview(null);
      setSelectedLogoFile(null);
      setShouldRemoveLogo(false);
      form.setFieldsValue({ logoFile: [] });
    }
  }, [selectedId, selectedClientData, form]);

  const handleAdd = () => {
    setSelectedId('new');
  };

  const handleSelect = (clientId) => {
      setSelectedId(clientId);
  };

  const handleCancel = () => {
    setSelectedId(null);
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого клиента? Это действие не может быть отменено.')) return;
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      const data = await res.json(); 
      if (!res.ok) {
        throw new Error(data.message || 'Ошибка удаления клиента');
      }
      appMessage.success('Клиент успешно удален');
      fetchClients();
      if (selectedId === clientId) {
        setSelectedId(null);
      }
    } catch (e) {
      appMessage.error(e.message || 'Не удалось удалить клиента. Возможно, с ним связаны юрлица или пользователи.');
    }
  };

  const handleFormSubmit = async (values) => {
    setLoading(true);
    const formData = new FormData();

    formData.append('name', values.name);

    if (selectedLogoFile) {
      formData.append('logoFile', selectedLogoFile, selectedLogoFile.name);
    } else if (shouldRemoveLogo && selectedClientData && selectedClientData.logo_url) {
      formData.append('removeLogo', 'true');
    }

    try {
      let response;
      const url = selectedId === 'new' ? `${API_URL}/api/clients` : `${API_URL}/api/clients/${selectedId}`;
      const method = selectedId === 'new' ? 'POST' : 'PUT';

      const fetchOptions = {
        method: method,
        body: formData,
      };

      response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ошибка ${response.status}` }));
        throw new Error(errorData.message || `Сервер ответил ошибкой ${response.status}`);
      }

      const result = await response.json();
      appMessage.success(`Клиент успешно ${selectedId === 'new' ? 'создан' : 'обновлен'}!`);
      setSelectedId(null);
      form.resetFields();
      setLogoPreview(null);
      setSelectedLogoFile(null);
      setShouldRemoveLogo(false);
      fetchClients();
    } catch (error) {
      console.error('Ошибка при сохранении клиента:', error);
      appMessage.error(`Ошибка при сохранении клиента: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = ({ file, fileList }) => {
    if (file.status === 'removed') {
      setSelectedLogoFile(null);
      setLogoPreview(selectedClientData?.logo_url || null);
      setShouldRemoveLogo(true);
      form.setFieldsValue({ logoFile: [] });
      return;
    }

    setShouldRemoveLogo(false);

    let rawFile = null;
    if (file.originFileObj) {
      rawFile = file.originFileObj;
    } else if (fileList.length > 0 && fileList[fileList.length - 1].originFileObj) {
      rawFile = fileList[fileList.length - 1].originFileObj;
    }

    if (rawFile) {
      setSelectedLogoFile(rawFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target.result);
      };
      reader.readAsDataURL(rawFile);

      form.setFieldsValue({ logoFile: [...fileList] });
    } else if (fileList.length === 0 && file.status !== 'removed') {
      setSelectedLogoFile(null);
      setLogoPreview(selectedClientData?.logo_url || null);
      form.setFieldsValue({ logoFile: [] });
    } else if (!rawFile && file.status !== 'removed') {
      form.setFieldsValue({ logoFile: [...fileList] });
    }
  };

  const triggerRemoveLogo = () => {
    setSelectedLogoFile(null);
    setLogoPreview(null);
    form.setFieldsValue({ logoFile: [] });
    setShouldRemoveLogo(true);
    appMessage.info('Логотип будет удален после сохранения клиента.');
  };

  return (
    <div className="list-detail-layout">
      <div className="list-container">
        <div className="list-header">
          <Title level={4} style={{ margin: 0, flex: 1 }}>Клиенты</Title>
          <Button className="add-list-item-button" type="primary" size="small" onClick={handleAdd}>
            Добавить
          </Button>
        </div>
        {loading && clients.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : clients.length > 0 ? (
          <div className="list-scroll-area">
            {clients.map(client => (
              <div
                key={client.id}
                onClick={() => handleSelect(client.id)}
                className={`list-item client-list-item ${selectedId === client.id ? 'selected' : ''}`}
              >
                <div className="list-item-content-wrapper">
                    <span className="list-item-line1">{client.name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <Empty description="Клиенты отсутствуют. Нажмите 'Добавить', чтобы создать первого." style={{marginTop: '30px'}}/>
        )}
      </div>

      <div className="detail-pane">
        {selectedId ? (
          <>
            <Title level={4} style={{ paddingTop: '16px', marginBottom: '24px', paddingLeft: '24px'}}>
              {selectedClientData ? `Редактировать клиента: ${selectedClientData.name}` : 'Добавить нового клиента'}
            </Title>
            <Form 
              form={form} 
              layout="vertical" 
              name="clientForm"
              onFinish={handleFormSubmit}
              style={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                paddingRight: '10px'
              }} 
              className="custom-scroll-list" 
            >
              <Form.Item
                name="name"
                label="Название клиента"
                rules={[{ required: true, message: 'Пожалуйста, введите название клиента!' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Логотип клиента"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {logoPreview && 
                    <div style={{ marginBottom: 8, border: '1px solid #d9d9d9', padding: '4px', borderRadius: '2px', display: 'inline-block' }}>
                      <img src={logoPreview} alt="Предпросмотр логотипа" style={{ maxWidth: '200px', maxHeight: '100px', display: 'block' }} />
                    </div>
                  }
                  <Upload
                    name="logoFile_uploader"
                    fileList={form.getFieldValue('logoFile') || []}
                    listType="picture"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleLogoChange}
                    accept=".png,.jpg,.jpeg,.gif,.webp"
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />} size="small">
                      {(form.getFieldValue('logoFile') && form.getFieldValue('logoFile').length > 0) || logoPreview
                        ? 'Изменить логотип' 
                        : 'Загрузить логотип'}
                    </Button>
                  </Upload>
                  {((form.getFieldValue('logoFile') && form.getFieldValue('logoFile').length > 0) || logoPreview) && !selectedLogoFile && (
                    <Button onClick={triggerRemoveLogo} size="small" danger style={{ marginTop: '8px' }}>
                      Удалить текущий логотип
                    </Button>
                  )}
                </Space>
                <Form.Item name="logoFile" hidden><Input /></Form.Item>
              </Form.Item>
              
              <Form.Item 
                style={{ 
                  marginTop: 'auto', 
                  paddingTop: '16px', 
                  borderTop: '1px solid #f0f0f0' 
                }}
              >
                <Space style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                    <div> 
                        <Button type="primary" htmlType="submit" loading={loading} style={{marginRight: '8px'}}>
                            {selectedClientData ? 'Сохранить изменения' : 'Создать клиента'}
                        </Button>
                        <Button onClick={handleCancel} disabled={loading}>
                            Отмена
                        </Button>
                    </div>
                    {selectedClientData && (
                        <Button 
                            danger 
                            onClick={() => handleDelete(selectedClientData.id)}
                            disabled={loading}
                        >
                            Удалить клиента
                        </Button>
                    )}
                </Space>
              </Form.Item>
            </Form>
          </>
        ) : clients.length > 0 && !loading ? (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined />
            <p>Выберите клиента из списка для просмотра или редактирования, или нажмите «Добавить» для создания нового.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ClientsPage; 