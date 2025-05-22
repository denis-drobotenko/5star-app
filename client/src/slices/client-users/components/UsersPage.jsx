import React, { useState, useEffect } from 'react';
import { Button, Typography, Form, Input, Select, Skeleton, Empty, Space, App as AntApp, Switch } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/constants/appConstants';

const { Title, Paragraph } = Typography;

// Компонент переименован для ясности, что это пользователи клиентов
function ClientUsersPage() { 
  const { message } = AntApp.useApp();
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]); // Список клиентов для выбора
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();
  // currentUserType теперь всегда 'CLIENT'
  // const [currentUserType, setCurrentUserType] = useState('CLIENT'); 

  const fetchClientUsers = async () => {
    setLoading(true);
    try {
      // Загружаем только пользователей типа CLIENT
      const res = await fetch(`${API_URL}/api/users?userType=CLIENT`); 
      if (!res.ok) throw new Error('Ошибка загрузки пользователей клиентов');
      let data = await res.json();
      data = Array.isArray(data) ? data : [];
      data = data.map(u => ({...u, clientName: u.client?.name }));
      setUsers(data);
    } catch (e) {
      message.error(e.message || 'Не удалось загрузить пользователей клиентов');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientsForSelect = async () => {
    // Эта функция остается, так как нужна для привязки пользователя к клиенту
    try {
      const res = await fetch(`${API_URL}/api/clients`);
      if (!res.ok) throw new Error('Ошибка загрузки списка клиентов');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message || 'Не удалось загрузить список клиентов для формы');
    }
  };

  useEffect(() => {
    fetchClientUsers();
    fetchClientsForSelect();
  }, []);

  const selectedUserData = selectedId && selectedId !== 'new' ? users.find(u => u.id === selectedId) : null;

  useEffect(() => {
    if (selectedId === 'new') {
      form.resetFields();
      // Для нового пользователя устанавливаем user_type CLIENT и роль CLIENT_CONTACT
      form.setFieldsValue({ 
        user_type: 'CLIENT', 
        is_active: true, 
        role: 'CLIENT_CONTACT',
        client_id: null // Клиент должен быть выбран
      });
    } else if (selectedUserData) {
      // user_type здесь всегда будет CLIENT
      const formData = { 
        ...selectedUserData, 
        client_id: selectedUserData.client?.id,
        // user_type: 'CLIENT' // Можно не устанавливать, т.к. не меняется
        // role: 'CLIENT_CONTACT' // Роль также не меняется
      };
      delete formData.client;
      form.setFieldsValue(formData);
    } else {
        form.resetFields();
    }
  }, [selectedId, selectedUserData, form]);

  const handleAdd = () => {
    setSelectedId('new');
  };

  const handleSelect = (userId) => {
    setSelectedId(userId);
  };
  
  const handleDelete = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя клиента?')) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Ошибка удаления пользователя клиента' }));
        throw new Error(errorData.message);
      }
      message.success('Пользователь клиента успешно удален');
      fetchClientUsers();
      if (selectedId === userId) {
        setSelectedId(null);
      }
    } catch (e) {
      message.error(e.message || 'Не удалось удалить пользователя клиента');
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
  };

  const handleFormSubmit = async (values) => {
    try {
      const payload = { 
        ...values, 
        user_type: 'CLIENT',
        role: 'CLIENT_CONTACT',
        username: values.email // Используем email как username
      };

      if (selectedUserData && selectedUserData.id && !payload.password) {
        delete payload.password;
      }

      // Проверка client_id остается важной
      if (!payload.client_id) {
        message.error('Для пользователя клиента необходимо выбрать компанию-клиента.');
        return;
      }
      
      // Удаляем поля, нерелевантные для CLIENT (например, phone, если решим его убрать)
      // delete payload.phone; // Если телефон не нужен для клиентских пользователей

      let res;
      if (selectedUserData && selectedUserData.id) {
        res = await fetch(`${API_URL}/api/users/${selectedUserData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (selectedUserData ? 'Ошибка обновления пользователя клиента' : 'Ошибка создания пользователя клиента'));
      }
      message.success(selectedUserData ? 'Пользователь клиента успешно обновлен' : 'Пользователь клиента успешно создан');
      setSelectedId(null);
      fetchClientUsers();
    } catch (e) {
      if (e.message) {
        message.error(e.message);
      } 
      console.error('Ошибка при сохранении пользователя клиента:', e);
    }
  };
  
  // handleUserTypeChange больше не нужен, так как тип пользователя фиксирован
  // const handleUserTypeChange = (type) => { ... };

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
          <Title level={4} style={{ margin: 0, flex: 1 }}>Пользователи</Title> 
          <Button className="add-list-item-button" type="primary" size="small" onClick={handleAdd}>
            Добавить
          </Button>
        </div>
        {loading && users.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : users.length > 0 ? (
          <div className="list-scroll-area">
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelect(user.id)}
                className={`list-item user-list-item ${selectedId === user.id ? 'selected' : ''}`}
              >
                <div className="list-item-content-wrapper">
                    <span className="list-item-line1">{user.full_name || user.username}</span>
                    <span className="list-item-line2">{user.email} ({user.client?.name || 'Клиент не указан'})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <Empty description="Пользователи клиентов отсутствуют. Нажмите 'Добавить', чтобы создать первого." style={{marginTop: '30px'}}/>
        )}
      </div>

      <div 
        className="detail-pane"
        style={{ 
          // flexGrow: 1,
          // display: 'flex',
          // flexDirection: 'column',
          // padding: '0 24px 24px 24px'
        }}
      > 
        {selectedId ? (
          <>
            <Title level={4} style={{ paddingTop: '16px', marginBottom: '24px', paddingLeft: '24px'}}>
              {selectedUserData ? `Редактировать пользователя: ${selectedUserData.username}` : 'Добавить нового пользователя'}
            </Title>
            <Form 
                form={form} 
                layout="vertical" 
                name="clientUserForm"
                onFinish={handleFormSubmit}
                initialValues={{
                  user_type: 'CLIENT',
                  is_active: true,
                  role: 'CLIENT_CONTACT'
                }}
                style={{ 
                    flexGrow: 1, 
                    overflowY: 'auto', 
                    paddingRight: '10px' 
                }} 
                className="custom-scroll-list" 
            >
                <Form.Item 
                    name="client_id" 
                    label="Компания-клиент"
                    rules={[{ required: true, message: 'Выберите компанию-клиента для этого пользователя!' }]}
                >
                    <Select placeholder="Выберите компанию-клиента" loading={clients.length === 0 && loading} showSearch optionFilterProp="children">
                        {clients.map(client => (
                            <Select.Option key={client.id} value={client.id}>{client.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item name="full_name" label="ФИО">
                    <Input />
                </Form.Item>
                
                <Form.Item name="position" label="Должность">
                    <Input />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, message: 'Введите email!' }, { type: 'email', message: 'Введите корректный email!' }]}
                >
                    <Input />
                </Form.Item>

                 <Form.Item name="phone" label="Телефон">
                    <Input />
                </Form.Item>

                <Form.Item
                    name="password"
                    label={selectedId === 'new' ? "Пароль" : "Новый пароль (оставьте пустым, если не меняете)"}
                    rules={[{ required: selectedId === 'new', message: 'Введите пароль!' }]}
                >
                    <Input.Password placeholder={selectedId === 'new' ? "Укажите пароль" : "Оставьте пустым, если не меняете"}/>
                </Form.Item>

                <Form.Item 
                    name="is_active" 
                    label="Статус" 
                    valuePropName="checked"
                >
                    <Switch checkedChildren="Активен" unCheckedChildren="Не активен" />
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
                                {selectedUserData ? 'Сохранить изменения' : 'Создать пользователя'}
                            </Button>
                            <Button onClick={handleCancel}>
                                Отмена
                            </Button>
                        </div>
                        {selectedUserData && (
                            <Button 
                                danger 
                                onClick={() => handleDelete(selectedUserData.id)}
                            >
                                Удалить
                            </Button>
                        )}
                    </Space>
                </Form.Item>
            </Form>
          </>
        ) : users.length > 0 && !loading ? (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined />
            <p>Выберите пользователя из списка для просмотра или редактирования, или нажмите «Добавить» для создания нового.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Экспортируем компонент с новым именем
export default ClientUsersPage; 