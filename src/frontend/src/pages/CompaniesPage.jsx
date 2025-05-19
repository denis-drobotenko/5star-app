import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, message, Space, Typography, Skeleton, Empty } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { API_URL } from '../constants/appConstants';

const { Title, Paragraph } = Typography;

function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]); // Для выбора клиента
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // null | number (id) | 'new'
  const [form] = Form.useForm();

  const fetchClientsForSelect = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients`);
      if (!res.ok) throw new Error('Ошибка загрузки списка клиентов для юрлиц');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message || 'Не удалось загрузить список клиентов для формы юрлиц');
    }
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/companies`);
      if (!res.ok) throw new Error('Ошибка загрузки юрлиц');
      let data = await res.json();
      data = Array.isArray(data) ? data : [];
      setCompanies(data);
    } catch (e) {
      message.error(e.message || 'Не удалось загрузить юрлица');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchClientsForSelect(); 
  }, []);

  const selectedCompany = selectedId && selectedId !== 'new' ? companies.find(c => c.id === selectedId) : null;

  useEffect(() => {
    requestAnimationFrame(() => {
      if (selectedCompany) {
        form.setFieldsValue(selectedCompany);
      } else if (selectedId === 'new') {
        form.resetFields();
      } else {
        form.resetFields(); 
      }
    });
  }, [selectedId, selectedCompany, form]);

  const handleSelect = (id) => setSelectedId(id);
  const handleAdd = () => setSelectedId('new');
  const handleCancel = () => setSelectedId(null);

  const handleSubmit = async (values) => {
    try {
      let res;
      const payload = { ...values };

      if (!payload.client_id) {
        message.error('Необходимо выбрать клиента для юрлица.');
        return;
      }

      if (selectedCompany) {
        res = await fetch(`${API_URL}/api/companies/${selectedCompany.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/api/companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || (selectedCompany ? 'Ошибка обновления' : 'Ошибка создания'));
      message.success(selectedCompany ? 'Юрлицо обновлено' : 'Юрлицо добавлено');
      setSelectedId(null);
      fetchCompanies();
    } catch (e) {
      message.error(e.message || 'Ошибка сохранения юрлица');
      console.error('Submit error:', e);
    }
  };
  
  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Вы уверены, что хотите удалить это юрлицо? Это действие не может быть отменено.')) return;
    try {
        const res = await fetch(`${API_URL}/api/companies/${companyId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Ошибка удаления юрлица' }));
            throw new Error(errorData.message);
        }
        message.success('Юрлицо успешно удалено');
        fetchCompanies(); 
        if (selectedId === companyId) {
            setSelectedId(null); 
        }
    } catch (e) {
        message.error(e.message || 'Не удалось удалить юрлицо.');
    }
  };

  return (
    <div className="list-detail-layout">
      <div className="list-container">
        <div className="list-header">
          <Title level={4} style={{ margin: 0, flex: 1 }}>Юрлица</Title>
          <Button className="add-list-item-button" type="primary" size="small" onClick={handleAdd}>
            Добавить
          </Button>
        </div>
        {loading && companies.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : companies.length > 0 ? (
          <div className="list-scroll-area">
            {companies.map(company => (
              <div
                key={company.id}
                onClick={() => handleSelect(company.id)}
                className={`list-item companies-list-item ${selectedId === company.id ? 'selected' : ''}`}
              >
                <div className="list-item-content-wrapper">
                    <span className="list-item-line1">{company.name}</span>
                    <span className="list-item-line2">ИНН: {company.inn}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <Empty description="Юрлица отсутствуют. Нажмите 'Добавить', чтобы создать первое." style={{marginTop: '30px'}}/>
        )}
      </div>

      <div className="detail-pane">
        {selectedId ? (
          <>
            <Title level={4} style={{ paddingTop: '16px', marginBottom: '24px', paddingLeft: '24px'}}>
              {selectedCompany ? `Редактировать юрлицо: ${selectedCompany.name}` : 'Добавить новое юрлицо'}
            </Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              style={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                paddingRight: '10px'
              }} 
              className="custom-scroll-list"
            >
              <Form.Item
                name="client_id"
                label="Клиент (владелец юрлица)"
                rules={[{ required: true, message: 'Выберите клиента!' }]}
              >
                <Select placeholder="Выберите клиента" loading={clients.length === 0 && loading} showSearch optionFilterProp="children">
                  {clients.map(client => (
                    <Select.Option key={client.id} value={client.id}>{client.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="name"
                label="Название юрлица"
                rules={[{ required: true, message: 'Введите название!' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="inn"
                label="ИНН"
                rules={[{ required: true, message: 'Введите ИНН!' }, { pattern: /^(\d{10}|\d{12})$/, message: 'ИНН должен состоять из 10 или 12 цифр'}] }
              >
                <Input />
              </Form.Item>
              <Form.Item name="kpp" label="КПП" rules={[{ pattern: /^\d{9}$/, message: 'КПП должен состоять из 9 цифр'}]}>
                <Input />
              </Form.Item>
              <Form.Item name="legal_address" label="Юридический адрес">
                <Input.TextArea />
              </Form.Item>
              <Form.Item name="postal_address" label="Почтовый адрес">
                <Input.TextArea />
              </Form.Item>
              <Form.Item name="actual_address" label="Фактический адрес">
                <Input.TextArea />
              </Form.Item>
              <Form.Item name="bank_details" label="Банковские реквизиты">
                <Input.TextArea />
              </Form.Item>
              <Form.Item name="edo_provider_name" label="Система ЭДО (название провайдера)">
                <Input />
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
                    <Button type="primary" htmlType="submit" style={{marginRight: '8px'}}>
                      {selectedCompany ? 'Сохранить изменения' : 'Создать юрлицо'}
                    </Button>
                    <Button onClick={handleCancel}>
                      Отмена
                    </Button>
                  </div>
                  {selectedCompany && (
                    <Button 
                      danger 
                      onClick={() => handleDeleteCompany(selectedCompany.id)}
                    >
                      Удалить
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </>
        ) : companies.length > 0 && !loading ? (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined />
            <p>Выберите юрлицо из списка для просмотра или редактирования, или нажмите «Добавить» для создания нового.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CompaniesPage; 