import { Auth0Provider } from '@auth0/auth0-react';
import { ReactNode } from 'react';

interface Auth0ProviderWithConfigProps {
  children: ReactNode;
}

export const Auth0ProviderWithConfig = ({ children }: Auth0ProviderWithConfigProps) => {
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
    redirectUri,
    envVariables: {
      REACT_APP_AUTH0_DOMAIN: process.env.REACT_APP_AUTH0_DOMAIN,
      REACT_APP_AUTH0_CLIENT_ID: process.env.REACT_APP_AUTH0_CLIENT_ID,
      REACT_APP_AUTH0_AUDIENCE: process.env.REACT_APP_AUTH0_AUDIENCE
    }
  });

  const onRedirectCallback = (appState: any) => {
    console.log('Auth0: Processing redirect callback with state:', appState);
    // Handle the redirect in the callback component
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
      skipRedirectCallback={false}
    >
      {children}
    </Auth0Provider>
  );
}; 