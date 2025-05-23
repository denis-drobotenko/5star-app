import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'antd/dist/reset.css';
import { App as AntApp } from 'antd';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AntApp>
    <App />
    </AntApp>
  </React.StrictMode>,
)
