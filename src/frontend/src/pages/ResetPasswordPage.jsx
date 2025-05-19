import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, App as AntApp } from 'antd';
import { API_URL, APP_NAME, TEXT_COLOR_DARK, MAIN_BACKGROUND_COLOR, DEFAULT_LOGIN_IMAGE_URL } from '../constants/appConstants';

const { Title, Paragraph } = Typography;

function ResetPasswordPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message: appMessage } = AntApp.useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState(null);
  const [loginBackground, setLoginBackground] = useState(DEFAULT_LOGIN_IMAGE_URL);
  const [appLogoUrl, setAppLogoUrl] = useState(null);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    } else {
      setError('Токен для сброса пароля не найден. Пожалуйста, запросите ссылку для сброса пароля заново.');
    }
    const storedLogoUrl = localStorage.getItem('appLogo');
    if (storedLogoUrl) setAppLogoUrl(storedLogoUrl);
    const storedLoginBg = localStorage.getItem('loginBackgroundUrl');
    if (storedLoginBg) setLoginBackground(storedLoginBg);
  }, [searchParams]);

  const onFinish = async (values) => {
    if (values.password !== values.confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }
    if (!token) {
      setError('Отсутствует токен для сброса. Запросите ссылку заново.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Не удалось сбросить пароль.');
      }
      setSuccess(data.message || 'Пароль успешно изменен. Теперь вы можете войти с новым паролем.');
      appMessage.success(data.message || 'Пароль успешно изменен! Пожалуйста, войдите.');
      
      form.resetFields();
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message || 'Произошла ошибка при сбросе пароля.');
      appMessage.error(err.message || 'Произошла ошибка при сбросе пароля.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.imageSection(loginBackground)}>
        {/* Левая часть с фоновым изображением */}
      </div>
      <div style={styles.formSection}>
        <div style={styles.formContainer}>
            <div style={styles.logoContainer}>
                {appLogoUrl ? (
                    <img src={appLogoUrl} alt="Логотип" style={styles.logo} />
                ) : (
                    <Title level={2} style={styles.appNameAsLogo}>{APP_NAME}</Title>
                )}
            </div>

            <Title level={3} style={{ textAlign: 'left', marginBottom: '24px', width: '100%' }}>
                Установка нового пароля
            </Title>
            
            {!token && error && <Alert message={error} type="error" showIcon style={{ marginBottom: '20px' }} />}
            
            {token ? (
              <Form
                form={form}
                name="reset-password-form"
                onFinish={onFinish}
                layout="vertical"
                requiredMark={false}
              >
                <Form.Item
                  name="password"
                  label="Новый пароль"
                  rules={[
                    { required: true, message: 'Пожалуйста, введите новый пароль!' },
                    { min: 6, message: 'Пароль должен быть не менее 6 символов!' },
                  ]}
                  hasFeedback
                >
                  <Input.Password placeholder="Минимум 6 символов" size="large" />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label="Подтвердите новый пароль"
                  dependencies={['password']}
                  hasFeedback
                  rules={[
                    { required: true, message: 'Пожалуйста, подтвердите ваш новый пароль!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Два введенных пароля не совпадают!'));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="Повторите пароль" size="large"/>
                </Form.Item>

                {error && !success && <Alert message={error} type="error" showIcon style={{ marginBottom: '20px' }}/>}
                {success && <Alert message={success} type="success" showIcon style={{ marginBottom: '20px' }}/>}

                <Form.Item style={{ marginTop: '10px' }}>
                  <Button type="primary" htmlType="submit" loading={loading} block size="large">
                    Установить новый пароль
                  </Button>
                </Form.Item>
              </Form>
            ) : (
                !error && <Paragraph>Загрузка данных о токене...</Paragraph>
            )}
             <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <a onClick={() => navigate('/login')} style={{color: TEXT_COLOR_DARK, fontSize: '14px'}}>
                    Вернуться ко входу
                </a>
            </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  imageSection: (loginBg) => ({
    flex: 2,
    backgroundImage: `url(${loginBg || DEFAULT_LOGIN_IMAGE_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }),
  formSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    backgroundColor: MAIN_BACKGROUND_COLOR,
    overflowY: 'auto',
  },
  formContainer: {
    width: '100%',
    maxWidth: '400px',
  },
  logoContainer: {
    textAlign: 'left',
    marginBottom: '32px',
  },
  logo: {
    maxWidth: '180px',
    maxHeight: '96px',
    height: 'auto',
  },
  appNameAsLogo: {
    margin: 0,
    color: TEXT_COLOR_DARK,
    fontSize: '38px',
    fontWeight: 'bold',
  },
};

export default ResetPasswordPage; 