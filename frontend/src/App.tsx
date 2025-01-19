import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { ToastContainer } from 'react-toastify';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from './components/layout/MainLayout';
import { theme } from './styles/themes/default';
import WebSocketService from './services/websocket';
import { loginSuccess, logout, setAuth0Token, setUser } from './store/auth/authSlice';
import { setAuth0Token as setApiAuth0Token, API_URL, apiRequest, decodeJwt } from './services/api/utils';
import { UserStatus, UserResponse } from './types';
import { RootState } from './store/store';
import Login from './components/auth/Login';
import SetupUsername from './components/auth/SetupUsername';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();
  const { user, token } = useSelector((state: RootState) => state.auth);
  
  console.log('ProtectedRoute - Path:', location.pathname, 'isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'hasUsername:', user?.username, 'hasToken:', !!token);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login from:', location.pathname);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Skip username check if we're already on the setup page
  if (!user?.username && location.pathname !== '/setup-username') {
    console.log('No username set, redirecting to username setup');
    return <Navigate to="/setup-username" state={{ from: location.pathname }} replace />;
  }

  // Don't check for token on setup page
  if (!token && location.pathname !== '/setup-username') {
    console.log('No token available, waiting for token');
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};

const LoginRedirect: React.FC = () => {
  const { loginWithRedirect } = useAuth0();
  const location = useLocation();
  const [showOldLogin, setShowOldLogin] = useState(true);
  
  const handleAuth0Login = () => {
    const returnUrl = location.pathname === '/login' ? '/' : location.pathname;
    console.log('Initiating Auth0 login with params:', {
      audience: 'http://localhost:8000/api',
      returnTo: returnUrl,
      redirectUri: `${window.location.origin}/callback`
    });
    
    loginWithRedirect({
      appState: { 
        returnTo: returnUrl,
        from: location.pathname 
      },
      authorizationParams: {
        audience: 'http://localhost:8000/api',
        redirect_uri: `${window.location.origin}/callback`,
        scope: 'openid profile email offline_access',
        response_type: 'code',
        prompt: 'login'
      }
    });
  };

  if (showOldLogin) {
    return (
      <Login 
        onLoginWithAuth0={handleAuth0Login}
        onLoginWithUsername={() => setShowOldLogin(false)} 
      />
    );
  }

  return <div>Redirecting to login...</div>;
};

const CallbackPage: React.FC = () => {
  const { isAuthenticated, isLoading, getAccessTokenSilently, user: auth0User } = useAuth0();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading || isProcessing) {
      return;
    }

    const setupAuth = async () => {
      try {
        setIsProcessing(true);
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access'
          }
        });

        setApiAuth0Token(token);
        dispatch(setAuth0Token(token));
        
        // Let Auth0Provider handle the redirection
      } catch (error) {
        console.error('Error in callback:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsProcessing(false);
      }
    };

    setupAuth();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, dispatch, isProcessing]);

  if (isLoading || isProcessing) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>Processing login...</div>;
};

const App: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
    user: auth0User,
    logout: auth0Logout
  } = useAuth0();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const [isTokenLoading, setIsTokenLoading] = useState(false);

  // Handle logout
  const handleLogout = () => {
    WebSocketService.disconnect();
    dispatch(logout());
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin + '/login',
        clientId: process.env.REACT_APP_AUTH0_CLIENT_ID
      }
    });
  };

  // Single effect for auth state management
  useEffect(() => {
    console.log('App - Auth state changed:', { 
      isAuthenticated, 
      isLoading, 
      auth0User,
      hasUsername: user?.username,
      hasToken: !!token,
      path: location.pathname,
      isTokenLoading
    });

    if (!isAuthenticated) {
      console.log('App - Not authenticated, disconnecting WebSocket');
      WebSocketService.disconnect();
      dispatch(logout());
      return;
    }

    if (isLoading || isTokenLoading) {
      console.log('App - Still loading');
      return;
    }

    const setupAuth = async () => {
      try {
        setIsTokenLoading(true);
        
        // Get token if we don't have one
        if (!token) {
          console.log('App - Getting new access token');
          const currentToken = await getAccessTokenSilently({
            authorizationParams: {
              audience: process.env.REACT_APP_AUTH0_AUDIENCE,
              scope: 'openid profile email offline_access'
            }
          });
          console.log('App - Setting Auth0 token in API and Redux');
          setApiAuth0Token(currentToken);
          dispatch(setAuth0Token(currentToken));
        }

        // Skip user info fetch if we're on certain pages
        const skipUserFetch = ['/setup-username', '/callback', '/login'].includes(location.pathname);
        if (skipUserFetch) {
          console.log('App - Skipping user info fetch on', location.pathname);
          return;
        }

        // Only fetch user info if we don't have it and we're not on a skip page
        if (!user?.username) {
          console.log('App - Fetching user info from backend');
          try {
            const userData = await apiRequest<UserResponse>('/users/me');
            console.log('App - User info fetched:', userData);
            
            if (userData.username) {
              dispatch(setUser({
                id: userData.id,
                username: userData.username,
                status: userData.status || 'online',
                avatar_url: userData.profile_picture_url,
                isBot: false
              }));
              
              // If we have a username, navigate to home
              if (location.pathname === '/setup-username') {
                navigate('/', { replace: true });
              }
            } else if (location.pathname !== '/setup-username') {
              // No username, redirect to setup if not already there
              navigate('/setup-username', { replace: true });
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
              console.log('App - User not found, will redirect to username setup');
              if (location.pathname !== '/setup-username') {
                navigate('/setup-username', { replace: true });
              }
              return;
            }
            console.error('App - Error fetching user info:', error);
            return;
          }
        }

        // Only connect WebSocket if we have a user
        if (user?.username && token) {
          console.log('App - User and token present, connecting WebSocket');
          WebSocketService.setAuth0Token(token);
          WebSocketService.connect();
        }
      } catch (error) {
        console.error('App - Error setting up auth:', error);
        if (error instanceof Error && !error.message.includes('401')) {
          handleLogout();
        }
      } finally {
        setIsTokenLoading(false);
      }
    };

    setupAuth();
  }, [isAuthenticated, isLoading, auth0User, user, token, getAccessTokenSilently, dispatch, location.pathname, navigate]);

  if (isLoading || isTokenLoading) {
    console.log('App - Still loading');
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/setup-username" element={
          !isAuthenticated ? <Navigate to="/login" replace /> : <SetupUsername />
        } />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginRedirect />
        } />
        <Route path="/*" element={
          <ProtectedRoute>
            <MainLayout onLogout={handleLogout} />
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