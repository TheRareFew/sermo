import { Auth0Provider } from '@auth0/auth0-react';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { apiRequest, setAuth0Token } from '../services/api/utils';
import { User } from '../types';

interface Auth0ProviderWithConfigProps {
  children: ReactNode;
}

// Create a wrapper component that handles auth state
const AuthStateHandler = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { getAccessTokenSilently, user, isAuthenticated, isLoading } = useAuth0();
  const EXPECTED_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasCheckedUser, setHasCheckedUser] = useState(false);

  // Handle authenticated user
  useEffect(() => {
    const checkUserStatus = async () => {
      // Skip if still loading or not authenticated
      if (isLoading || !isAuthenticated) {
        setIsInitializing(false);
        return;
      }

      // Skip if we've already checked the user
      if (hasCheckedUser) {
        return;
      }

      try {
        // Get and set token
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: EXPECTED_AUDIENCE,
            scope: 'openid profile email offline_access'
          }
        });
        setAuth0Token(token);

        // Get user data
        const userData = await apiRequest<User>('/users/me', {
          method: 'GET'
        }).catch(async () => {
          // If user doesn't exist, create them
          await apiRequest('/users/auth0', {
            method: 'POST',
            body: JSON.stringify({ email: user?.email })
          });
          return apiRequest<User>('/users/me', { method: 'GET' });
        });

        // Handle navigation based on user state
        const currentPath = window.location.pathname;
        if (!userData.username && currentPath !== '/setup-username') {
          navigate('/setup-username', { replace: true });
        } else if (userData.username && (currentPath === '/setup-username' || currentPath === '/login')) {
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Error in auth flow:', error);
      } finally {
        setHasCheckedUser(true);
        setIsInitializing(false);
      }
    };

    checkUserStatus();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, navigate, EXPECTED_AUDIENCE, user, hasCheckedUser]);

  if (isInitializing) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};

// Create the main Auth0 provider component
export const Auth0ProviderWithConfig = ({ children }: Auth0ProviderWithConfigProps) => {
  const navigate = useNavigate();
  const EXPECTED_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;
  const domain = process.env.REACT_APP_AUTH0_DOMAIN;
  const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID;
  const redirectUri = `${window.location.origin}/callback`;

  if (!domain || !clientId || !EXPECTED_AUDIENCE) {
    throw new Error('Required Auth0 environment variables are not set');
  }

  const onRedirectCallback = async (appState: any) => {
    navigate(appState?.returnTo || '/');
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: EXPECTED_AUDIENCE,
        scope: 'openid profile email offline_access'
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation="localstorage"
      useRefreshTokensFallback={true}
    >
      <AuthStateHandler>
        {children}
      </AuthStateHandler>
    </Auth0Provider>
  );
}; 