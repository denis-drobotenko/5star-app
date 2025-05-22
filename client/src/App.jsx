import React, { useState, useEffect } from 'react'
import { Button, Typography, Menu, Layout, Table, Modal, Form, Input, message, Select, Skeleton, Upload, Space, Card, Progress, ConfigProvider, Row, Col, Empty, App as AntApp, Spin } from 'antd'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation, Outlet } from 'react-router-dom'
import { InfoCircleOutlined, TableOutlined, UploadOutlined, LeftOutlined, RightOutlined, SettingOutlined, PlusOutlined, LoadingOutlined, TeamOutlined, UsergroupAddOutlined, HomeOutlined, ApartmentOutlined, BranchesOutlined } from '@ant-design/icons'
import './App.css'
import { AuthProvider, useAuth } from './slices/auth/AuthContext'
import { 
  API_URL, 
  APP_NAME, 
  PRIMARY_ACCENT_COLOR, 
  MAIN_BACKGROUND_COLOR, 
  TEXT_COLOR_DARK, 
  SIDER_DARK_BACKGROUND_COLOR, 
  SIDER_TEXT_COLOR, 
  SIDER_MENU_ITEM_SELECTED_BG_COLOR_DARK,
  SIDER_MENU_ITEM_HOVER_BG_COLOR_DARK,
  BUTTON_PRIMARY_TEXT_COLOR
} from './shared/constants/appConstants'
import LoginPage from './slices/auth/components/LoginPage'
import DashboardLayout from './slices/dashboard/components/DashboardLayout'
import DashboardHomePage from './slices/dashboard/components/DashboardHomePage'
import CompaniesPage from './slices/companies/components/CompaniesPage'
import ClientsPage from './slices/clients/components/ClientsPage'
import ClientUsersPage from './slices/client-users/components/UsersPage'
import FieldMappingPage from './slices/field-mapping/components/FieldMappingPage'
import SettingsPage from './slices/settings/components/SettingsPage'
import ResetPasswordPage from './slices/auth/components/ResetPasswordPage'
import { DataImportsPage } from "./slices/data-import"

const { Title, Paragraph } = Typography;
const { Header, Content, Sider } = Layout;

function PrivateRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();
  
  if (auth.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location, authRequired: true }} replace />;
  }
  return children;
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: PRIMARY_ACCENT_COLOR,
          colorTextBase: TEXT_COLOR_DARK,
          colorBgLayout: MAIN_BACKGROUND_COLOR,
          fontFamily: 'inherit',
        },
        components: {
          Layout: {
            siderBg: SIDER_DARK_BACKGROUND_COLOR,
            bodyBg: MAIN_BACKGROUND_COLOR,
          },
          Menu: {
            itemBg: 'transparent',
            itemColor: SIDER_TEXT_COLOR,
            itemHoverColor: PRIMARY_ACCENT_COLOR,
            itemHoverBg: SIDER_MENU_ITEM_HOVER_BG_COLOR_DARK,
            itemSelectedColor: PRIMARY_ACCENT_COLOR,
            itemSelectedBg: SIDER_MENU_ITEM_SELECTED_BG_COLOR_DARK,
            darkItemBg: SIDER_DARK_BACKGROUND_COLOR,
            darkItemColor: SIDER_TEXT_COLOR,
            darkItemSelectedBg: SIDER_MENU_ITEM_SELECTED_BG_COLOR_DARK,
            darkItemSelectedColor: PRIMARY_ACCENT_COLOR,
          },
          Button: {
            colorPrimary: PRIMARY_ACCENT_COLOR,
            colorPrimaryHover: '#FFC733',
            colorPrimaryActive: '#E6A500',
            colorTextPrimary: BUTTON_PRIMARY_TEXT_COLOR,
            defaultGhostColor: PRIMARY_ACCENT_COLOR,
            defaultGhostBorderColor: PRIMARY_ACCENT_COLOR,
          },
          Typography: {
            colorTextHeading: TEXT_COLOR_DARK,
            colorText: TEXT_COLOR_DARK,
            colorTextDescription: 'var(--text-color-light)',
          },
          Card: {
            colorBgContainer: '#FFFFFF',
          },
          Modal: {
             colorBgElevated: '#FFFFFF',
          },
          Input: {
            colorBgContainer: '#FFFFFF',
          },
          Select: {
            colorBgContainer: '#FFFFFF',
          },
          Table: {
            colorBgContainer: '#FFFFFF',
          }
        },
      }}
    >
      <AntApp>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route 
                  path="/dashboard/*" 
                  element={
                    <PrivateRoute>
                      <DashboardLayout />
                    </PrivateRoute>
                  }
                >
                  <Route index element={<DashboardHomePage />} />
                <Route path="companies" element={<CompaniesPage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="users" element={<ClientUsersPage />} />
                <Route path="field-mappings" element={<FieldMappingPage />} />
                <Route path="data-imports" element={<DataImportsPage />} />
                  <Route path="settings/*" element={<SettingsPage />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </AuthProvider>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
