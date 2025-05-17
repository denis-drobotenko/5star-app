import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

function DashboardHomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden' }}>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '24px' }}>
      <Title level={2}>Добро пожаловать!</Title>
      <Paragraph>Выберите раздел в меню слева.</Paragraph>
      </div>
    </div>
  );
}

export default DashboardHomePage; 