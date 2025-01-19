# SSL and Auth0 Implementation Plan

## Overview
This document outlines the step-by-step process to implement SSL certificates and Auth0 authentication in our chat application.

## Prerequisites
- Domain name configured and pointing to server
- Access to server with sudo privileges 
- Auth0 account created

## Implementation Steps

### 1. SSL Certificate Setup
- [ ] Install Certbot and Nginx
[CODE START]
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
[CODE END]

- [ ] Obtain SSL Certificate
[CODE START]
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
[CODE END]

### 2. Auth0 Configuration

#### Auth0 Dashboard Setup
- [ ] Create new Auth0 Application
- [ ] Configure Application Settings:
  - Allowed Callback URLs: https://your-domain.com/callback
  - Allowed Logout URLs: https://your-domain.com/login
  - Allowed Web Origins: https://your-domain.com
  - Allowed Origins (CORS): https://your-domain.com

#### Environment Variables
- [ ] Create/update .env files:

Backend (.env):
[CODE START]
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=your-api-identifier
AUTH0_ISSUER=https://your-tenant.auth0.com/
AUTH0_ALGORITHMS=RS256
[CODE END]

Frontend (.env):
[CODE START]
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=your-api-identifier
REACT_APP_AUTH0_CALLBACK_URL=https://your-domain.com/callback
[CODE END]

### 3. Backend Implementation

#### Create Auth0 Verification Module
Create new file: backend/app/auth/auth0.py
[CODE START]
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWTError
import requests
from functools import lru_cache
import os

security = HTTPBearer()

@lru_cache()
def get_auth0_public_key():
    domain = os.getenv("AUTH0_DOMAIN")
    url = f"https://{domain}/.well-known/jwks.json"
    response = requests.get(url)
    return response.json()

async def verify_auth0_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        jwks = get_auth0_public_key()
        unverified_header = jwt.get_unverified_header(token)
        
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=[os.getenv("AUTH0_ALGORITHMS")],
            audience=os.getenv("AUTH0_AUDIENCE"),
            issuer=os.getenv("AUTH0_ISSUER")
        )
        return payload
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
[CODE END]

### 4. Frontend Implementation

#### Install Auth0 Dependencies
[CODE START]
npm install @auth0/auth0-react
[CODE END]

#### Create Auth0 Provider
Create new file: frontend/src/providers/Auth0Provider.tsx
[CODE START]
import { Auth0Provider } from '@auth0/auth0-react';

export const Auth0ProviderWithConfig = ({ children }) => {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE
      }}
    >
      {children}
    </Auth0Provider>
  );
};
[CODE END]

### 5. Nginx Configuration

Create/update Nginx config file: /etc/nginx/sites-available/your-domain.conf
[CODE START]
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
[CODE END]

### 6. Update WebSocket Connection

Update WebSocket service to include Auth0 token:
Reference file: frontend/src/services/websocket/index.ts
[CODE START]
private async connect() {
  const { getAccessTokenSilently } = useAuth0();
  try {
    const token = await getAccessTokenSilently();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    // Rest of connection logic...
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
  }
}
[CODE END]

### 7. Testing Checklist
- [ ] SSL certificate is properly installed and working
- [ ] Auth0 login flow works
- [ ] API calls work with Auth0 tokens
- [ ] WebSocket connections work over WSS
- [ ] Logout functionality works
- [ ] Token refresh works correctly
- [ ] All redirects work properly
- [ ] No mixed content warnings in browser console

### 8. Security Headers

Add security headers to Nginx config:
[CODE START]
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "default-src 'self' https://*.auth0.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.auth0.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.auth0.com; connect-src 'self' https://*.auth0.com wss://your-domain.com;";
[CODE END]

### 9. SSL Certificate Auto-Renewal

Set up automatic renewal:
[CODE START]
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
[CODE END]

## Notes
- Keep Auth0 client secrets and other sensitive data in environment variables
- Regularly rotate Auth0 client secrets
- Monitor SSL certificate expiration
- Keep Auth0 SDK and dependencies updated
- Test WebSocket reconnection logic with token refresh