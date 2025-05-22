import React, { useState } from 'react';
import { Modal, Button, Skeleton, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { API_URL } from '../constants/appConstants'; // путь уже корректный, так как оба файла в shared

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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setLogs(data.logs || 'Логи пусты');
    } catch (error) {
      message.error('Не удалось загрузить логи: ' + error.message);
      setLogs('Ошибка загрузки логов.'); // Set a user-friendly message in case of error
    } finally {
      setLoading(false);
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
    fetchLogs(); // Initial fetch when modal opens
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
        destroyOnHidden
      >
        <div className="debug-logs-modal-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '60vh', overflowY: 'auto', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {loading ? <Skeleton active /> : logs}
        </div>
      </Modal>
    </>
  );
}

export default DebugLogsButton; 