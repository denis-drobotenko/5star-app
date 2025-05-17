import React, { useState, useEffect } from 'react';
import { Button, Typography, Form, Input, Select, Skeleton, Empty, Space, App as AntApp, Switch } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { API_URL } from '../constants/appConstants';

const { Title } = Typography;

function InternalUsersPage() { 
  const { message } = AntApp.useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form] = Form.useForm();

  const fetchInternalUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users?userType=INTERNAL`); 
      if (!res.ok) throw new Error('Ошибка загрузки внутренних пользователей');
      let data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message || 'Не удалось загрузить внутренних пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInternalUsers();
  }, []);

  const selectedUserData = selectedId && selectedId !== 'new' ? users.find(u => u.id === selectedId) : null;

  useEffect(() => {
    if (selectedId === 'new') {
      form.resetFields();
      form.setFieldsValue({ 
        user_type: 'INTERNAL',
        is_active: true, 
        role: 'MODERATOR' 
      });
    } else if (selectedUserData) {
      form.setFieldsValue({
        ...selectedUserData,
        password: '' 
      });
    } else {
        form.resetFields();
    }
  }, [selectedId, selectedUserData, form]);

  const handleAdd = () => {
    setSelectedId('new');
    form.resetFields();
    form.setFieldsValue({ 
      user_type: 'INTERNAL',
      is_active: true, 
      role: 'MODERATOR' 
    });
  };

  const handleSelect = (userId) => {
    setSelectedId(userId);
  };
  
  const handleDelete = async () => {
    if (!selectedId || selectedId === 'new') return;
    if (!window.confirm('Вы уверены, что хотите удалить этого внутреннего пользователя?')) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Ошибка удаления внутреннего пользователя' }));
        throw new Error(errorData.message);
      }
      message.success('Внутренний пользователь успешно удален');
      fetchInternalUsers();
      setSelectedId(null);
      form.resetFields();
    } catch (e) {
      message.error(e.message || 'Не удалось удалить внутреннего пользователя');
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    form.resetFields();
  };

  const handleFormSubmit = async (values) => {
    try {
      const payload = { 
        ...values, 
        user_type: 'INTERNAL',
        username: values.email 
      };

      delete payload.client_id;
      delete payload.position;

      if (selectedUserData && selectedUserData.id && !payload.password) {
        delete payload.password;
      } else if (!payload.password && selectedId === 'new') {
        message.error('Пароль обязателен при создании нового пользователя.');
        return;
      } else if (payload.password && payload.password.length < 6) {
        message.error('Пароль должен быть не менее 6 символов.');
        return;
      }

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
        throw new Error(data.message || (selectedUserData ? 'Ошибка обновления внутреннего пользователя' : 'Ошибка создания внутреннего пользователя'));
      }
      message.success(selectedUserData ? 'Внутренний пользователь успешно обновлен' : 'Внутренний пользователь успешно создан');
      setSelectedId(null);
      fetchInternalUsers();
      form.resetFields();
    } catch (e) {
      if (e.message) {
        message.error(e.message);
      } 
      console.error('Ошибка при сохранении внутреннего пользователя:', e);
    }
  };
  
  return (
    <div className="list-detail-layout">
      <div className="list-container"> 
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
                    <span className="list-item-line2">{user.email} ({user.role})</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <Empty description="Внутренние пользователи отсутствуют. Нажмите 'Добавить', чтобы создать первого." style={{marginTop: '30px'}}/>
        )}
      </div>

      <div className="detail-pane"> 
        {selectedId ? (
          <>
            <Title level={4} style={{ marginBottom: '24px', paddingLeft: '24px', paddingTop: '16px' }}>
              {selectedUserData ? `Редактировать пользователя` : 'Добавить нового пользователя'}
            </Title>
            <Form 
                form={form} 
                layout="vertical" 
                name="internalUserForm" 
                onFinish={handleFormSubmit}
                style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '10px' }} 
                className="custom-scroll-list" 
            >
                <Form.Item name="full_name" label="ФИО">
                    <Input placeholder="Введите ФИО"/>
                </Form.Item>
                
                <Form.Item
                    name="email"
                    label="Email (Логин)"
                    rules={[
                        { required: true, message: 'Введите email!' }, 
                        { type: 'email', message: 'Введите корректный email!' }
                    ]}
                >
                    <Input placeholder="example@domain.com"/>
                </Form.Item>

                <Form.Item name="phone" label="Телефон">
                    <Input placeholder="+7 (XXX) XXX-XX-XX"/>
                </Form.Item>

                <Form.Item 
                    name="role" 
                    label="Роль в системе" 
                    rules={[{ required: true, message: 'Выберите роль!' }]}
                >
                    <Select placeholder="Выберите роль">
                        <Select.Option value="ADMIN">Администратор</Select.Option>
                        <Select.Option value="ANALYST">Аналитик</Select.Option>
                        <Select.Option value="MODERATOR">Модератор</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="password"
                    label={selectedId === 'new' ? "Пароль" : "Новый пароль (оставьте пустым, если не меняете)"}
                    rules={[
                        { required: selectedId === 'new', message: 'Введите пароль!' }, 
                        { min: 6, message: 'Пароль должен быть не менее 6 символов' }
                    ]}
                >
                    <Input.Password placeholder={selectedId === 'new' ? "Минимум 6 символов" : "Оставьте пустым, если не меняете"} />
                </Form.Item>
                
                <Form.Item 
                    name="is_active" 
                    label="Статус" 
                    valuePropName="checked"
                >
                    <Switch checkedChildren="Активен" unCheckedChildren="Не активен" />
                </Form.Item>

                {/* <div style={{ height: '600px', border: '2px solid red', background: 'rgba(255,0,0,0.05)', padding: '10px', margin: '10px 0' }}>FORCED SCROLL TEST BLOCK 1 (InternalUsersPage Form)</div> */}
                {/* <div style={{ height: '600px', border: '2px solid green', background: 'rgba(0,255,0,0.05)', padding: '10px', margin: '10px 0' }}>FORCED SCROLL TEST BLOCK 2 (InternalUsersPage Form)</div> */}
                
                <Form.Item>
                  <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '16px' }}>
                      <Space>
                          <Button type="primary" htmlType="submit">
                              {selectedUserData ? 'Сохранить изменения' : 'Создать пользователя'}
                          </Button>
                          <Button onClick={handleCancel}>
                              Отмена
                          </Button>
                      </Space>
                      {selectedUserData && (
                          <Button danger onClick={handleDelete}>
                              Удалить пользователя
                          </Button>
                      )}
                  </Space>
                </Form.Item>
            </Form>
          </>
        ) : (
          <div className="detail-pane-instruction" style={{ paddingLeft: '24px' }}>
            <InfoCircleOutlined /> 
            <p>Выберите пользователя из списка для просмотра или редактирования, или нажмите "Добавить" для создания нового внутреннего пользователя.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InternalUsersPage; 