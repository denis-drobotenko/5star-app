import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../../shared/constants/appConstants'; // Импортируем API_URL

// Константа API_URL УДАЛЕНА отсюда, так как перенесена в constants/appConstants.js

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const location = useLocation(); 

  const loginUser = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json(); 

      if (!res.ok) {
        throw new Error(data.message || `Ошибка авторизации (статус: ${res.status})`);
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      setLoading(false); 
      return data; 
    } catch (err) {
      localStorage.removeItem('token'); 
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      throw err; 
    }
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0];
      const options = args[1];

      if (typeof url === 'string' && !url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i) && !url.includes('vite/client')) {
        const token = localStorage.getItem('token');
        if (token) {
          const currentOptions = options || {};
          const headers = currentOptions.headers || {};
          args[1] = {
            ...currentOptions,
            headers: {
              ...headers,
              'Authorization': `Bearer ${token}`
            }
          };
        }
      }

      try {
        const response = await originalFetch(...args);
        return await handleFetchError(response);
      } catch (error) {
        throw error; 
      }
    };

    const handleFetchError = async (response) => {
      if (response.status === 401 && !response.url.includes('/auth/login')) { 
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch; 
    };
  }, []); 

   useEffect(() => {
    const authContextCheckAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      if (isAuthenticated) {
        if (loading) setLoading(false); 
        return;
      }

      setLoading(true); 
      try {
        const response = await fetch(`${API_URL}/auth/verify`);

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    authContextCheckAuth();
  }, [location.pathname, isAuthenticated, loading]); // Добавлены isAuthenticated и loading в зависимости, чтобы избежать лишних вызовов


  const value = {
    isAuthenticated,
    user,
    loading,
    loginUser, 
    logoutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 