#!/bin/bash
# MidasHub VPS Deployment Script
# Run this on a fresh Ubuntu 22/24 VPS

set -e

echo "⚡ MidasHub VPS Setup"
echo "===================="

# 1. Install Node.js 20
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git

# 2. Clone and setup
echo "📥 Cloning project..."
cd /home
if [ -d "midashub" ]; then
  cd midashub && git pull
else
  git clone https://github.com/andrew1544-art/MidasHub1.git midashub
  cd midashub
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Create .env file
echo "🔧 Setting up environment..."
if [ ! -f .env.local ]; then
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=https://www.midashub.sbs
VAPID_PRIVATE_KEY=your_vapid_private_key
ENVEOF
echo "⚠️  EDIT .env.local with your real keys!"
echo "   nano /home/midashub/.env.local"
exit 1
fi

# 5. Build
echo "🔨 Building..."
npm run build

# 6. Setup PM2
echo "🔄 Setting up PM2..."
sudo npm install -g pm2
pm2 delete midashub 2>/dev/null || true
PORT=3000 pm2 start npm --name "midashub" -- start
pm2 save
pm2 startup | tail -1 | bash

# 7. Setup Nginx
echo "🌐 Setting up Nginx..."
sudo tee /etc/nginx/sites-available/midashub << 'NGINXEOF'
server {
    listen 80;
    server_name www.midashub.sbs midashub.sbs;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/midashub /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 8. SSL Certificate
echo "🔒 Getting SSL certificate..."
sudo certbot --nginx -d www.midashub.sbs -d midashub.sbs --non-interactive --agree-tos --email andrewedward1544@gmail.com

echo ""
echo "✅ MidasHub is live!"
echo "   URL: https://www.midashub.sbs"
echo ""
echo "📋 Useful commands:"
echo "   pm2 logs midashub     — View logs"
echo "   pm2 restart midashub  — Restart app"
echo "   cd /home/midashub && git pull && npm run build && pm2 restart midashub  — Deploy update"
