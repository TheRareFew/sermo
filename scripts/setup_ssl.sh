#!/bin/bash

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Get domain name
if [ -z "$1" ]; then
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
else
    DOMAIN=$1
fi

echo "Setting up SSL for $DOMAIN..."

# Update system
apt update
apt upgrade -y

# Install Nginx and Certbot
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/sermo-app << EOL
# HTTP - Redirect all traffic to HTTPS
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS - Serve application
server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable site configuration
ln -sf /etc/nginx/sites-available/sermo-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Obtain SSL certificate
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

# Reload Nginx
systemctl reload nginx

# Test auto-renewal
certbot renew --dry-run

echo "SSL setup complete for $DOMAIN"
echo "Please verify the following:"
echo "1. Visit https://${DOMAIN} to ensure it's working"
echo "2. Test WebSocket connection"
echo "3. Update Auth0 configuration with the new domain"
echo "4. Update frontend environment files with the new domain" 