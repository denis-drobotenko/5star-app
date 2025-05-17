import React, { useState } from 'react';
import { Button, Typography, Upload, message, Card, Row, Col, List } from 'antd';
import { LoadingOutlined, PlusOutlined, PictureOutlined, EditOutlined } from '@ant-design/icons';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { APP_NAME } from '../constants/appConstants';
import InternalUsersPage from './InternalUsersPage';

const { Title, Paragraph } = Typography;

const SETTING_KEYS = {
  LOGO: 'logo',
  LOGIN_BACKGROUND: 'loginBackground',
};

// Компонент для настроек интерфейса
function InterfaceSettings() {
  const [logoSrc, setLogoSrc] = useState(localStorage.getItem('appLogo') || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loginBgSrc, setLoginBgSrc] = useState(localStorage.getItem('loginBackgroundUrl') || null);
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false);
  const [selectedSettingKey, setSelectedSettingKey] = useState(SETTING_KEYS.LOGO);

  const handleLogoUpload = (file) => {
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem('appLogo', reader.result);
        setLogoSrc(reader.result);
        message.success('Логотип успешно загружен!');
        window.dispatchEvent(new Event('storage')); 
      } catch (e) {
        message.error('Не удалось сохранить логотип. Возможно, превышен лимит localStorage.');
        console.error("Error saving logo to localStorage: ", e);
      }
      setUploadingLogo(false);
    };
    reader.onerror = () => {
      message.error('Ошибка при чтении файла.');
      setUploadingLogo(false);
    };
    if (file.size > 2 * 1024 * 1024) { 
        message.error('Файл слишком большой. Максимальный размер 2MB.');
        setUploadingLogo(false);
        return false;
    }
    reader.readAsDataURL(file);
    return false; 
  };

  const handleRemoveLogo = () => {
    localStorage.removeItem('appLogo');
    setLogoSrc(null);
    message.info('Логотип удален.');
    window.dispatchEvent(new Event('storage'));
  };

  const handleLoginBgUpload = (file) => {
    setUploadingLoginBg(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem('loginBackgroundUrl', reader.result);
        setLoginBgSrc(reader.result);
        message.success('Фон страницы входа успешно загружен!');
        window.dispatchEvent(new Event('storage')); // Уведомить LoginPage, если открыта
      } catch (e) {
        message.error('Не удалось сохранить фон. Возможно, превышен лимит localStorage.');
        console.error("Error saving login background to localStorage: ", e);
      }
      setUploadingLoginBg(false);
    };
    reader.onerror = () => {
      message.error('Ошибка при чтении файла фона.');
      setUploadingLoginBg(false);
    };
    if (file.size > 5 * 1024 * 1024) { 
        message.error('Файл слишком большой. Максимальный размер 5MB.');
        setUploadingLoginBg(false);
        return false;
    }
    reader.readAsDataURL(file);
    return false; 
  };

  const handleRemoveLoginBg = () => {
    localStorage.removeItem('loginBackgroundUrl');
    setLoginBgSrc(null);
    message.info('Фон страницы входа удален. Будет использоваться фон по умолчанию.');
    window.dispatchEvent(new Event('storage'));
  };

  const settingsMenuItems = [
    {
      key: SETTING_KEYS.LOGO,
      title: 'Логотип приложения',
      content: (
        <Card bordered={false} style={{ boxShadow: 'none' }} bodyStyle={{ padding: 0 }}>
          <Paragraph>Загрузите логотип, который будет отображаться в верхней части левой панели и на странице входа.</Paragraph>
          <Upload
            name="logo"
            listType="picture-card"
            className="avatar-uploader" 
            showUploadList={false}
            beforeUpload={handleLogoUpload}
            accept="image/png, image/jpeg, image/svg+xml, image/gif"
            disabled={uploadingLogo}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="Логотип" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
            <div>
                {uploadingLogo ? <LoadingOutlined /> : <PlusOutlined />}
                <div style={{ marginTop: 8 }}>Загрузить лого</div>
              </div>
            )}
          </Upload>
          {logoSrc && (
            <Button danger onClick={handleRemoveLogo} style={{ marginTop: 16 }}>
              Удалить логотип
            </Button>
          )}
          <Paragraph style={{ marginTop: 24, color: 'var(--text-color-light)'}}>
            Если логотип не загружен, будет отображаться название: "{APP_NAME}".
          </Paragraph>
        </Card>
      )
    },
    {
      key: SETTING_KEYS.LOGIN_BACKGROUND,
      title: 'Фон страницы входа',
      content: (
        <Card bordered={false} style={{ boxShadow: 'none' }} bodyStyle={{ padding: 0 }}>
          <Paragraph>Загрузите изображение, которое будет использоваться в качестве фона на странице входа в систему (слева).</Paragraph>
          <Upload
            name="loginBg"
            listType="picture-card"
            className="login-bg-uploader"
            showUploadList={false}
            beforeUpload={handleLoginBgUpload}
            accept="image/png, image/jpeg, image/webp"
            disabled={uploadingLoginBg}
          >
            {loginBgSrc ? (
              <img src={loginBgSrc} alt="Фон страницы входа" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
            <div>
                {uploadingLoginBg ? <LoadingOutlined /> : <PlusOutlined />}
                <div style={{ marginTop: 8 }}>Загрузить фон</div>
              </div>
            )}
          </Upload>
          {loginBgSrc && (
            <Button danger onClick={handleRemoveLoginBg} style={{ marginTop: 16 }}>
              Удалить фон
            </Button>
          )}
           <Paragraph style={{ marginTop: 24, color: 'var(--text-color-light)'}}>
            Если фон не загружен, будет использоваться стандартное изображение.
          </Paragraph>
        </Card>
      )
    }
  ];

  const renderSettingContent = () => {
    const selected = settingsMenuItems.find(item => item.key === selectedSettingKey);
    return selected ? (
      <>
        <Title level={4} style={{ paddingTop: '16px', marginBottom: '24px', paddingLeft: '24px' }}>
          {selected.title}
        </Title>
        <div style={{ paddingLeft: '24px', paddingRight: '24px', paddingBottom: '24px' }}>
          {selected.content}
        </div>
      </>
    ) : null;
  };

  return (
    <div className="list-detail-layout" style={{ height: '100%'}}>
      <div className="list-container" style={{width: '280px', minWidth: '280px'}}>
        <div className="list-header">
             <Title level={4} style={{ margin: 0, flex: 1 }}>Параметры интерфейса</Title>
        </div>
        <div className="list-scroll-area">
            {settingsMenuItems.map(item => (
              <div
                key={item.key}
                className={`list-item interface-setting-item ${selectedSettingKey === item.key ? 'selected' : ''}`}
                onClick={() => setSelectedSettingKey(item.key)}
                style={{display: 'flex', alignItems: 'center', gap: '10px'}}
              >
                <span className="list-item-line1">{item.title}</span>
              </div>
            ))}
        </div>
      </div>
      <div className="detail-pane custom-scroll-list" style={{ padding: '0px' }}>
         {renderSettingContent()} 
      </div>
    </div>
  );
}

function SettingsPage() {
  const location = useLocation();
  // Если путь /dashboard/settings, перенаправляем на /dashboard/settings/interface
  if (location.pathname === '/dashboard/settings' || location.pathname === '/dashboard/settings/') {
    return <Navigate to="interface" replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', height: '100%', overflow: 'hidden'}}> 
      <Routes>
        <Route path="interface" element={
          <div style={{flex: '1 1 auto', overflowY: 'auto' }}>
            <InterfaceSettings />
            {/* <div style={{ height: '500px', background: 'lightblue', marginTop: '20px' }}>Test Block 1</div> */}
            {/* <div style={{ height: '500px', background: 'lightcoral', marginTop: '20px' }}>Test Block 2</div> */}
          </div>
        } />
        <Route path="users" element={<InternalUsersPage />} />
      </Routes>
    </div>
  );
}

export default SettingsPage; 