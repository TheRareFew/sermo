import { Auth0Provider } from '@auth0/auth0-react';
import { ReactNode, useEffect } from 'react';
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

  // Handle authenticated user
  useEffect(() => {
    const checkUserStatus = async () => {
      if (isLoading || !isAuthenticated) {
        return;
      }

      console.log('Checking user status...', { isAuthenticated, isLoading });

      try {
        // Get a fresh token
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: EXPECTED_AUDIENCE,
            scope: 'openid profile email offline_access'
          }
        });
        
        console.log('Got token, setting for API requests');
        // Set the token for API requests
        setAuth0Token(token);

        try {
          // First, ensure user exists in our database
          console.log('Creating/updating user in database...');
          const existingUser = await apiRequest<User>('/users/me', {
            method: 'GET'
          }).catch(() => null);

          if (!existingUser) {
            // Create user without username first
            console.log('Creating new user...');
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            while (!success && retryCount < maxRetries) {
              try {
                await apiRequest('/users/auth0', {
                  method: 'POST',
                  body: JSON.stringify({
                    email: user?.email
                  })
                });
                success = true;
              } catch (error) {
                console.error(`Error creating user (attempt ${retryCount + 1}):`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                  // Wait for 1 second before retrying
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }

            if (!success) {
              console.error('Failed to create user after multiple attempts');
              return;
            }
          }

          // Then fetch user data
          console.log('Fetching user data...');
          let userData = null;
          let retryCount = 0;
          const maxRetries = 3;

          while (!userData && retryCount < maxRetries) {
            try {
              userData = await apiRequest<User>('/users/me', {
                method: 'GET'
              });
            } catch (error) {
              console.error(`Error fetching user data (attempt ${retryCount + 1}):`, error);
              retryCount++;
              if (retryCount < maxRetries) {
                // Wait for 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!userData) {
            console.error('Failed to fetch user data after multiple attempts');
            return;
          }

          console.log('User data response:', userData);

          // Always redirect to username setup if no username
          if (!userData.username) {
            console.log('No username set, redirecting to setup...');
            if (window.location.pathname !== '/setup-username') {
              navigate('/setup-username', { replace: true });
            }
            return;
          }

          // If we get here, user exists and has a username
          console.log('Username is set, redirecting to home...');
          if (window.location.pathname === '/setup-username') {
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('Error checking user data:', error);
          // If 404 or other error, redirect to username setup
          if (window.location.pathname !== '/setup-username') {
            navigate('/setup-username', { replace: true });
          }
        }
      } catch (error) {
        console.error('Error in auth flow:', error);
      }
    };

    checkUserStatus();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, navigate, EXPECTED_AUDIENCE, user]);

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

  console.log('Auth0Provider initializing with config:', {
    domain,
    clientId,
    audience: EXPECTED_AUDIENCE,
    redirectUri
  });

  const onRedirectCallback = async (appState: any) => {
    console.log('Auth0: Processing redirect callback with state:', appState);
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