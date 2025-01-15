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
import { AuthProvider } from './contexts/AuthContext';

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
        return <SignupForm onLoginClick={() => setCurrentView('login')} />;
      case 'forgot-password':
        return <ForgotPasswordForm onLoginClick={() => setCurrentView('login')} />;
      default:
        return null;
    }
  };

  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <div className="App">
          <Routes>
            <Route
              path="/login"
              element={!isAuthenticated ? renderAuthContent() : <Navigate to="/" replace />}
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App; 