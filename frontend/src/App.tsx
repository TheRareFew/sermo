import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import ForgotPassword from './components/auth/ForgotPassword';
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

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
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
          <ForgotPassword
            onLoginClick={() => setCurrentView('login')}
          />
        )}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <MainLayout />
    </ThemeProvider>
  );
};

export default App; 