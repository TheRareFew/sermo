import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { ToastContainer } from 'react-toastify';
import { Routes, Route, Navigate } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import LoginForm from './components/auth/LoginForm/index';
import SignupForm from './components/auth/SignupForm/index';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm/index';
import MainLayout from './components/layout/MainLayout';
import { theme } from './styles/themes/default';
import { RootState } from './types';
import WebSocketService from './services/websocket';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [currentView, setCurrentView] = useState<'login' | 'signup' | 'forgot-password'>('login');

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView('login');
      WebSocketService.disconnect();
    } else {
      WebSocketService.connect();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    console.log('API URL:', process.env.REACT_APP_API_URL);
  }, []);

  const renderAuthContent = () => {
    switch (currentView) {
      case 'login':
        return (
          <LoginForm
            onSignupClick={() => setCurrentView('signup')}
            onForgotPasswordClick={() => setCurrentView('forgot-password')}
          />
        );
      case 'signup':
        return (
          <SignupForm
            onLoginClick={() => setCurrentView('login')}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onLoginClick={() => setCurrentView('login')}
          />
        );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : renderAuthContent()
        } />
        <Route path="/*" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        } />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        theme="dark"
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: '1rem'
        }}
        toastStyle={{
          background: theme.colors.background,
          color: theme.colors.text,
          border: `2px solid ${theme.colors.border}`,
          borderRadius: 0,
          boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.5)'
        }}
      />
    </ThemeProvider>
  );
};

export default App; 