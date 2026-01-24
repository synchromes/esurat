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

# 6. Database & Environment Setup
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[-] .env file not found. Starting Automatic Configuration...${NC}"
    
    # 6a. Install MySQL if not present
    if ! command -v mysql &> /dev/null; then
        echo -e "${YELLOW}[-] MySQL not found. Installing MySQL Server...${NC}"
        sudo apt-get install -y mysql-server
        sudo systemctl start mysql
        sudo systemctl enable mysql
    fi

    # 6b. Generate Credentials
    DB_NAME="esurat_db"
    DB_USER="esurat_user"
    DB_PASS=$(openssl rand -base64 12)
    AUTH_SECRET=$(openssl rand -base64 32)
    
    echo -e "${YELLOW}[-] Creating Database and User...${NC}"
    # Create DB and User (Idempotent)
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
    sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
    sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    sudo mysql -e "FLUSH PRIVILEGES;"
    
    echo -e "${GREEN}[+] Database created: ${DB_NAME}${NC}"
    echo -e "${GREEN}[+] User created: ${DB_USER}${NC}"

    # 6c. Create .env file
    echo -e "${YELLOW}[-] Generating .env file...${NC}"
    
    cat > .env <<EOF
# Database
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"

# Authentication
NEXTAUTH_URL="https://esurat.tvrikalbar.id"
NEXTAUTH_SECRET="${AUTH_SECRET}"

# App Config
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE="10485760"

# WhatsApp Gateway (Default)
WA_API_URL="http://localhost:5001"
WA_SESSION="esurat"

# Server
PORT=3000
NODE_ENV="production"
EOF

    echo -e "${GREEN}[+] .env file generated successfully!${NC}"
else
    echo -e "${GREEN}[+] .env file exists. Skipping configuration.${NC}"
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
