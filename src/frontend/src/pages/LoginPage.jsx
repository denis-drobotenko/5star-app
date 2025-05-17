import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Typography, Skeleton, Form, Input } from 'antd';
// import { InfoCircleOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'; // Иконки удалены
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME, TEXT_COLOR_DARK, MAIN_BACKGROUND_COLOR } from '../constants/appConstants';

const { Title, Paragraph, Text } = Typography;

// URL для изображения по умолчанию - ЗАМЕНИТЕ НА ВАШ, если хотите другой стандартный фон
const DEFAULT_LOGIN_IMAGE_URL = 'https://images.unsplash.com/photo-1527176930608-308b87f80141?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80'; 

function LoginPage() {
  const [loadingForm, setLoadingForm] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [form] = Form.useForm();
  const [appLogoUrl, setAppLogoUrl] = useState(null);
  const [loginBackground, setLoginBackground] = useState(DEFAULT_LOGIN_IMAGE_URL);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    const storedLogoUrl = localStorage.getItem('appLogo');
    if (storedLogoUrl) {
      setAppLogoUrl(storedLogoUrl);
    }

    const storedLoginBg = localStorage.getItem('loginBackgroundUrl');
    if (storedLoginBg) {
      setLoginBackground(storedLoginBg);
    }

    // Слушатель для обновления фона, если он изменится в другой вкладке (на странице настроек)
    const handleStorageChange = (event) => {
      if (event.key === 'loginBackgroundUrl') {
        setLoginBackground(localStorage.getItem('loginBackgroundUrl') || DEFAULT_LOGIN_IMAGE_URL);
      }
      if (event.key === 'appLogo') { // Также обновляем лого, если нужно
        setAppLogoUrl(localStorage.getItem('appLogo'));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    if (!auth.loading && auth.isAuthenticated) {
      navigate(from, { replace: true });
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [auth.isAuthenticated, auth.loading, navigate, from]);

  const handleSubmit = async (values) => {
    setLoadingForm(true);
    setError('');
    try {
      await auth.loginUser(values.email, values.password);
      // navigate(from, { replace: true }); // auth.useEffect будет обрабатывать редирект
    } catch (err) {
      setError(err.message || 'Произошла неизвестная ошибка');
    } finally {
      setLoadingForm(false);
    }
  };

  if (auth.loading && !auth.isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Skeleton active paragraph={{ rows: 4 }} style={{ maxWidth: '400px' }}/>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.imageSection(loginBackground)}>
        {/* Можно добавить оверлей с текстом или оставить просто изображение */}
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
          {/* <Title level={3} style={styles.title}>
            Вход в систему
          </Title> */}
          
          {location.state?.authRequired && (
            <div style={styles.authRequiredMessage}>
              {/* <InfoCircleOutlined style={{ color: TEXT_COLOR_DARK, marginRight: '8px' }} /> */}
              Для продолжения работы необходимо войти в систему
            </div>
          )}

          <Form
            form={form}
            name="login-form"
            onFinish={handleSubmit}
            layout="vertical"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Пожалуйста, введите ваш Email!' },
                { type: 'email', message: 'Введите корректный Email!' }
              ]}
            >
              <Input /* prefix={<MailOutlined />} */ placeholder="Email" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Пожалуйста, введите ваш пароль!' }]}
            >
              <Input.Password /* prefix={<LockOutlined />} */ placeholder="Пароль" size="large" />
            </Form.Item>

            {error && (
              <Form.Item>
                <Paragraph type="danger" style={{ color: 'red', textAlign: 'center', marginBottom: 0 }}>
                  {error}
                </Paragraph>
              </Form.Item>
            )}

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loadingForm} block size="large">
                Войти
              </Button>
            </Form.Item>
          </Form>
          {/* Можно добавить ссылки типа "Забыли пароль?" или "Регистрация" здесь */}
          {/* <Text style={{ textAlign: 'center', display: 'block', marginTop: 24 }}>
            Нет аккаунта? <a href="/register">Зарегистрироваться</a>
          </Text> */}
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
    overflow: 'hidden', // Предотвратить прокрутку всей страницы
  },
  imageSection: (loginBg) => ({
    flex: 2, // Занимает 2/3 ширины
    backgroundImage: `url(${loginBg || DEFAULT_LOGIN_IMAGE_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    // Для отладки, если изображение не видно:
    // backgroundColor: 'lightblue', 
  }),
  formSection: {
    flex: 1, // Занимает 1/3 ширины
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    backgroundColor: MAIN_BACKGROUND_COLOR,
    overflowY: 'auto', // Прокрутка для формы, если она не помещается
  },
  formContainer: {
    width: '100%',
    maxWidth: '400px', // Ограничиваем максимальную ширину формы
  },
  logoContainer: {
    textAlign: 'left',
    marginBottom: '32px',
  },
  logo: {
    maxWidth: '180px', // Уменьшено с 225px (225 * 0.8)
    maxHeight: '96px', // Уменьшено с 120px (120 * 0.8)
    height: 'auto',
  },
  appNameAsLogo: { // Стиль для названия приложения, если нет логотипа
    margin: 0,
    color: TEXT_COLOR_DARK,
    fontSize: '38px', // Уменьшено с 48px (48 * 0.8 = 38.4, округлено)
    fontWeight: 'bold',
  },
  authRequiredMessage: {
    padding: '12px',
    background: '#f8f8f8',      // Очень светло-серый фон
    border: '1px solid #d9d9d9', // Стандартная серая рамка AntD
    borderRadius: '4px',
    marginBottom: '20px',
    textAlign: 'left',
    fontSize: '14px',
    color: TEXT_COLOR_DARK,      // Цвет текста сообщения, если нужно
  }
};

export default LoginPage; 