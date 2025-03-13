# Host Website Deployment Guide

This guide explains how to deploy multiple host websites on a single Digital Ocean droplet using PM2 process manager.

## Prerequisites

- DigitalOcean droplet with Ubuntu (recommended: 8GB RAM, 4 CPU cores)
- Node.js 18+ installed on the server
- PM2 installed globally: `npm install -g pm2`
- Nginx installed for reverse proxy

## Setup Process

### 1. Server Setup

Start by setting up your server with the necessary software:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

### 2. Directory Structure

Create a directory structure for host websites:

```bash
mkdir -p /var/www/hosts
cd /var/www/hosts
```

Each host will have their own directory:

```
/var/www/hosts/
  ├── host1/
  ├── host2/
  ├── host3/
  └── ...
```

### 3. Clone Template Site

For each host, clone the template site and configure it:

```bash
# Clone the repo to host directory (replace host1 with actual host name)
git clone https://github.com/your-repo/airbnb-direct-booking.git /var/www/hosts/host1

# Navigate to host directory
cd /var/www/hosts/host1

# Install dependencies
npm install --production
```

### 4. Configure Environment Variables

Create a `.env.local` file for each host with their specific configuration:

```bash
# Create .env.local with host-specific values
cat > .env.local << EOL
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ptjuhkqxhmpvchbtbuke.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=host-stripe-publishable-key
STRIPE_SECRET_KEY=host-stripe-secret-key
STRIPE_WEBHOOK_SECRET=host-stripe-webhook-secret

# Application
NEXT_PUBLIC_APP_URL=https://host1.yourdomain.com

# Property ID
NEXT_PUBLIC_PROPERTY_ID=specific-property-id-for-this-host
EOL
```

### 5. Build the Application

Build each host site:

```bash
# Build the Next.js application
npm run build
```

### 6. Configure PM2

Start each host site with PM2 on a unique port:

```bash
# Start the application with PM2 on a specific port
PORT=3001 pm2 start npm --name "host1" -- start

# Repeat for each host with incremental port numbers
PORT=3002 pm2 start npm --name "host2" -- start
PORT=3003 pm2 start npm --name "host3" -- start
```

Save the PM2 configuration to start automatically on server reboot:

```bash
pm2 startup
pm2 save
```

### 7. Configure Nginx as Reverse Proxy

Create an Nginx server block for each host:

```bash
# Create configuration for host1
sudo nano /etc/nginx/sites-available/host1

# Add the following configuration
server {
    listen 80;
    server_name host1.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/host1 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Set Up Domain DNS

Configure your domain DNS to point to your DigitalOcean server IP address for each subdomain.

### 9. SSL Setup with Let's Encrypt

Install Certbot and get SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d host1.yourdomain.com
```

## Monitoring and Management

Use these PM2 commands to manage your applications:

```bash
# List all running applications
pm2 list

# View logs for a specific application
pm2 logs host1

# Restart an application
pm2 restart host1

# Stop an application
pm2 stop host1

# Delete an application from PM2
pm2 delete host1
```

## Adding a New Host

To add a new host to your server:

1. Create a new directory for the host
2. Clone the template site
3. Configure the host-specific environment variables
4. Build the application
5. Start with PM2 on a unique port
6. Configure Nginx reverse proxy
7. Set up the domain and SSL certificate

## Troubleshooting

Common issues and solutions:

- **502 Bad Gateway**: Check if the Node.js application is running on the correct port
- **Application crashes**: Check the PM2 logs with `pm2 logs host1`
- **SSL errors**: Ensure Certbot configured the SSL certificates correctly
- **Performance issues**: Monitor server resources and consider upgrading your droplet if necessary

## Backup and Recovery

Set up regular backups of each host's environment files and database:

```bash
# Create a backup script
cat > /var/www/backup.sh << EOL
#!/bin/bash
BACKUP_DIR="/var/backups/hosts"
DATE=\$(date +%Y-%m-%d)
mkdir -p \$BACKUP_DIR

# Backup all .env.local files
for HOST_DIR in /var/www/hosts/*/; do
  HOST=\$(basename \$HOST_DIR)
  cp \$HOST_DIR/.env.local \$BACKUP_DIR/\$HOST-env-\$DATE.bak
done
EOL

# Make the script executable
chmod +x /var/www/backup.sh

# Add to crontab to run daily
(crontab -l 2>/dev/null; echo "0 0 * * * /var/www/backup.sh") | crontab -
``` 