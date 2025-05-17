import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { Layout, Menu, Button, Typography, message, Modal, Skeleton } from 'antd';
import { 
    HomeOutlined, 
    ApartmentOutlined, 
    TeamOutlined, 
    UsergroupAddOutlined, 
    BranchesOutlined, 
    SettingOutlined,
    InfoCircleOutlined, // Для DebugLogsButton
    BuildOutlined, // Для подпункта "Интерфейс"
    UserOutlined // Для подпункта "Пользователи" в Настройках
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME, API_URL } from '../constants/appConstants'; // API_URL для DebugLogsButton

const { Title } = Typography; // Title используется в Sider

// DebugLogsButton остается здесь временно, будет вынесен позже
function DebugLogsButton() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/debug-log`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setLogs(data.logs || 'Логи пусты');
    } catch (error) {
      console.error('Error fetching logs:', error);
      message.error('Ошибка при загрузке логов');
    } finally {
      setLoading(false);
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
    fetchLogs();
  };

  return (
    <>
      <Button 
        onClick={showModal}
        icon={<InfoCircleOutlined />}
        block
      >
        Отладочные логи
      </Button>
      <Modal
        title="Отладочные логи"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="refresh" onClick={fetchLogs} loading={loading}>
            Обновить
          </Button>,
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={800}
      >
        <div className="debug-logs-modal-content">
          {loading ? <Skeleton active /> : logs}
        </div>
      </Modal>
    </>
  );
}

function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth() 
  const [currentLogo, setCurrentLogo] = useState(localStorage.getItem('appLogo') || null);

  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentLogo(localStorage.getItem('appLogo') || null);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    auth.logoutUser();
    navigate('/login')
  }
  
  // Определение selectedKey удалено, так как menuItems теперь использует location.pathname напрямую в selectedKeys

  const menuItems = [
    { key: '/dashboard', icon: <HomeOutlined />, label: <Link to="/dashboard">Главная</Link> },
    { key: '/dashboard/clients', icon: <TeamOutlined />, label: <Link to="/dashboard/clients">Клиенты</Link> },
    { key: '/dashboard/companies', icon: <ApartmentOutlined />, label: <Link to="/dashboard/companies">Юрлица</Link> },
    { key: '/dashboard/users', icon: <UsergroupAddOutlined />, label: <Link to="/dashboard/users">Пользователи</Link> },
    { key: '/dashboard/field-mappings', icon: <BranchesOutlined />, label: <Link to="/dashboard/field-mappings">Маппинг полей</Link> },
    {
      key: '/dashboard/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      children: [
        {
          key: '/dashboard/settings/interface',
          icon: <BuildOutlined />,
          label: <Link to="/dashboard/settings/interface">Интерфейс</Link>,
        },
        {
          key: '/dashboard/settings/users',
          icon: <UserOutlined />,
          label: <Link to="/dashboard/settings/users">Пользователи</Link>,
        },
      ],
    },
  ];

  // Correctly determine selected and open keys for parent/child menu items
  let selectedKeys = [location.pathname];
  let defaultOpenKeys = [];

  menuItems.forEach(item => {
    if (item.children) {
      item.children.forEach(child => {
        if (location.pathname.startsWith(child.key)) {
          selectedKeys = [child.key]; // Highlight the child
          defaultOpenKeys = [item.key]; // Open the parent group
        }
      });
    }
  });
  // If the main settings path is somehow directly navigated to, ensure the group is open
  if (location.pathname === '/dashboard/settings') {
    defaultOpenKeys = ['/dashboard/settings'];
     // Optionally, select the first child as default
    if (menuItems.find(item => item.key === '/dashboard/settings')?.children?.[0]) {
        selectedKeys = [menuItems.find(item => item.key === '/dashboard/settings').children[0].key];
    }
  }

  return (
    <Layout className="dashboard-layout" style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Layout.Sider width={250} theme="dark" className="app-sider">
        <div className="dashboard-sider-header">
          {currentLogo ? (
            <img src={currentLogo} alt="App Logo" className="sider-logo-image" />
          ) : (
            <Title level={4} className="dashboard-sider-title">{APP_NAME}</Title>
          )}
        </div>
        <Menu 
          mode="inline" 
          selectedKeys={selectedKeys}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems} 
          className="dashboard-sider-menu" 
        />
        <div className="dashboard-sider-footer">
          <DebugLogsButton />
          <Button onClick={handleLogout} block type="primary">Выйти</Button>
        </div>
      </Layout.Sider>
      <Layout style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Layout.Content className="dashboard-content">
          <Outlet /> 
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default DashboardLayout; 