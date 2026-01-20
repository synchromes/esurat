# VPS Deployment Instructions (Ubuntu)

This guide explains how to deploy the E-Surat 2.0 application to your Ubuntu VPS using the automated `deploy.sh` script.

## 1. Prerequisites
*   Ubuntu VPS (20.04 or 22.04 recommended).
*   Root or Sudo access.
*   Domain pointed to your VPS IP (e.g., `esurat.tvrikalbar.id`).

## 2. Quick Deployment

1.  **Upload the Script**:
    Copy `deploy.sh` to your VPS (e.g., using SCP or by creating the file directly).
    ```bash
    scp deploy.sh user@your-vps-ip:~/
    ```

2.  **Run the Script**:
    SSH into your server and run:
    ```bash
    chmod +x deploy.sh
    sudo ./deploy.sh
    ```
    This will:
    *   Update system packages.
    *   Install Node.js 20, Git, PM2, and Nginx.
    *   Clone the repo to `/var/www/esurat.tvrikalbar.id`.
    *   Install dependencies and build the app.
    *   Configure Nginx and start the app with PM2.

## 3. Post-Deployment Steps

1.  **Configure Environment Variables**:
    The script attempts to create a `.env` file. You **MUST** edit this file with your production secrets!
    ```bash
    sudo nano /var/www/esurat.tvrikalbar.id/.env
    ```
    Update `DATABASE_URL`, `NEXTAUTH_SECRET`, etc.

2.  **Restart Application**:
    After editing `.env`:
    ```bash
    pm2 reload esurat-tvrikalbar
    ```

3.  **Setup SSL (HTTPS)**:
    Secure your site with a free Let's Encrypt certificate:
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d esurat.tvrikalbar.id
    ```

## 4. Updates
To update the application in the future, simply run the `deploy.sh` script again! It handles `git pull`, migrations, and rebuilding automatically.
