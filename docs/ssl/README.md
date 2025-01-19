# SSL Configuration Guide

## Production Environment (Ubuntu Linux)

### 1. Install Certbot and Obtain SSL Certificate
```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

### 2. Nginx Configuration
Create or modify `/etc/nginx/sites-available/sermo-app`:

```nginx
# HTTP - Redirect all traffic to HTTPS
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Serve application
server {
    listen 443 ssl;
    server_name your_domain.com www.your_domain.com;

    ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS (uncomment if you're sure)
    # add_header Strict-Transport-Security "max-age=31536000" always;

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
```

### 3. Enable and Test Configuration
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/sermo-app /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 4. Auto-renewal Setup
```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot creates a systemd timer automatically, verify with:
systemctl list-timers | grep certbot
```

## Development Environment

### Windows Development
For local development on Windows, we use HTTP without SSL:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- WebSocket: ws://localhost:8000/ws

### Environment Files
The repository includes separate environment files for development and production:

1. `.env.development` - Local development settings (HTTP)
```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_AUTH0_CALLBACK_URL=http://localhost:3000/callback
```

2. `.env.production` - Production settings (HTTPS)
```env
REACT_APP_API_URL=https://your_domain.com/api
REACT_APP_WS_URL=wss://your_domain.com/ws
REACT_APP_AUTH0_CALLBACK_URL=https://your_domain.com/callback
```

### Environment Differences and Considerations

#### Protocol Handling
- **Development**: Uses HTTP/WS protocols
  - No SSL certificates needed
  - Direct communication with services
  - Faster local development setup

- **Production**: Uses HTTPS/WSS protocols
  - SSL certificates managed by Certbot
  - Nginx handles SSL termination
  - All external traffic is encrypted

#### Internal Traffic
- **Development**: Direct communication
  - Frontend → Backend: HTTP
  - WebSocket: WS

- **Production**: Proxied through Nginx
  - External: HTTPS/WSS
  - Internal: HTTP/WS (between Nginx and services)
  - SSL termination at Nginx level

#### Building and Deployment
```bash
# Development
npm start  # Uses .env.development

# Production
npm run build  # Uses .env.production
```

#### Version Control Considerations
- Both `.env.development` and `.env.production` should be maintained
- SSL configuration lives on the server, not in the codebase
- No code changes needed when switching environments

### Auth0 Configuration
Auth0 is configured to accept both HTTP and HTTPS callbacks:

Development:
- Callback URL: http://localhost:3000/callback
- Logout URL: http://localhost:3000
- Allowed Web Origins: http://localhost:3000

Production:
- Callback URL: https://your_domain.com/callback
- Logout URL: https://your_domain.com
- Allowed Web Origins: https://your_domain.com

## Deployment Checklist

1. [ ] Replace all instances of `your_domain.com` with actual domain
2. [ ] Install SSL certificate using Certbot
3. [ ] Configure Nginx with provided configuration
4. [ ] Update Auth0 application settings with production URLs
5. [ ] Test SSL configuration using SSL Labs
6. [ ] Verify WebSocket connections over WSS
7. [ ] Test Auth0 authentication flow
8. [ ] Enable HSTS if appropriate
9. [ ] Verify correct environment file is used during build
10. [ ] Confirm internal HTTP routing works behind Nginx
11. [ ] Test both WebSocket protocols (WS in dev, WSS in prod)

## Security Best Practices

1. Keep SSL certificates up to date
2. Regularly update Nginx and Certbot
3. Monitor SSL certificate expiration
4. Use secure SSL protocols (TLSv1.2+)
5. Implement appropriate security headers
6. Regular security audits
7. Maintain secure backup of SSL certificates 