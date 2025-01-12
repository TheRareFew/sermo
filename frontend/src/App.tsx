import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import MainLayout from './components/layout/MainLayout';
import { theme } from './styles/themes/default';
import { RootState } from './types';

const App: React.FC = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [currentView, setCurrentView] = useState<'login' | 'signup' | 'forgot-password'>('login');

  // Reset to login view when logging out
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView('login');
    }
  }, [isAuthenticated]);

  return (
    <ThemeProvider theme={theme}>
      {!isAuthenticated ? (
        <>
          {currentView === 'login' && (
            <LoginForm
              onSignupClick={() => setCurrentView('signup')}
              onForgotPasswordClick={() => setCurrentView('forgot-password')}
            />
          )}
          {currentView === 'signup' && (
            <SignupForm
              onLoginClick={() => setCurrentView('login')}
            />
          )}
          {currentView === 'forgot-password' && (
            <ForgotPasswordForm
              onLoginClick={() => setCurrentView('login')}
            />
          )}
        </>
      ) : (
        <MainLayout />
      )}
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