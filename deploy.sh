#!/bin/bash

# ==========================================
# E-Surat 2.0 - Automated Deployment Script
# ==========================================

# Configuration
APP_DIR="/var/www/esurat.tvrikalbar.id"
REPO_URL="https://github.com/synchromes/esurat.git"
APP_NAME="esurat-tvrikalbar"
PORT=3000

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}[*] Starting Deployment Process for ${APP_NAME}...${NC}"

# 1. System Updates & Dependencies
echo -e "${YELLOW}[-] Updating system packages...${NC}"
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git unzip build-essential

# 2. Install Node.js 20 (LTS) if not present
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[-] Node.js not found. Installing Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}[+] Node.js is already installed: $(node -v)${NC}"
fi

# 3. Install Global Tools (PM2)
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}[-] PM2 not found. Installing globally...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}[+] PM2 is already installed.${NC}"
fi

# 4. Install Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}[-] Nginx not found. Installing...${NC}"
    sudo apt-get install -y nginx
    sudo ufw allow 'Nginx Full'
else
    echo -e "${GREEN}[+] Nginx is already installed.${NC}"
fi

# 5. Application Setup
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}[-] Directory exists. Pulling latest changes...${NC}"
    cd "$APP_DIR"
    git reset --hard
    git pull origin main
else
    echo -e "${YELLOW}[-] Cloning repository to $APP_DIR...${NC}"
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 6. Environment Check
if [ ! -f ".env" ]; then
    echo -e "${RED}[!] .env file is missing!${NC}"
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[-] Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${RED}[IMPORTANT] Please edit .env file with your specific configuration (Database, Auth Secret, etc) and run this script again or run 'npm run build' manually.${NC}"
        # We don't exit, but build might fail if DB connection needed for generation
    fi
fi

# 7. Install Dependencies & Build
echo -e "${YELLOW}[-] Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}[-] Generating Prisma Client...${NC}"
npx prisma generate

echo -e "${YELLOW}[-] Running Database Migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}[-] Building Next.js Application...${NC}"
npm run build

# 8. PM2 Process Management
echo -e "${YELLOW}[-] Configuring PM2...${NC}"
if pm2 list | grep -q "$APP_NAME"; then
    echo -e "${GREEN}[+] Reloading existing process...${NC}"
    pm2 reload "$APP_NAME"
else
    echo -e "${GREEN}[+] Starting new process...${NC}"
    pm2 start npm --name "$APP_NAME" -- start
    pm2 save
    # Note: User might need to run 'pm2 startup' manually once
fi

# 9. Nginx Configuration
NGINX_CONF="/etc/nginx/sites-available/esurat.tvrikalbar.id"
if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${YELLOW}[-] Creating Nginx Configuration...${NC}"
    sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name esurat.tvrikalbar.id;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    echo -e "${GREEN}[+] Nginx Config Created.${NC}"
    
    # Enable Site
    if [ ! -f "/etc/nginx/sites-enabled/esurat.tvrikalbar.id" ]; then
        sudo ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/
    fi
    
    # Test and Reload
    sudo nginx -t && sudo systemctl reload nginx
else
    echo -e "${GREEN}[+] Nginx configuration already exists.${NC}"
fi

echo -e "${GREEN}[SUCCESS] Deployment Complete!${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Check your .env file in $APP_DIR"
echo -e "2. Configure SSL with Certbot: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d esurat.tvrikalbar.id"
