# VPS Deployment Guide

## Prerequisites

- Docker & Docker Compose installed
- Git installed
- A domain (optional, for reverse proxy)

## Quick Start

```bash
# Clone
git clone git@github.com:duralsh/hyperliquid-copy-trader.git
cd hyperliquid-copy-trader

# Configure
cp .env.example .env
nano .env
```

Fill in your `.env`:

```env
ARENA_API_KEY=your_key
ARENA_BASE_URL=https://api.starsarena.com
MAIN_WALLET_PRIVATE_KEY=0x...
MAIN_WALLET_ADDRESS=0x...
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
APP_SECRET=<run: openssl rand -hex 32>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong_password>
```

```bash
# Create data directory
mkdir -p data

# Build and run
docker compose up -d --build

# Verify
docker logs -f hl-trader-dashboard
```

Dashboard available at `http://<your-vps-ip>:3002`

## Reverse Proxy (Nginx)

If you have other sites on the machine, use Nginx to proxy a domain/subdomain:

```nginx
server {
    listen 80;
    server_name trader.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then add HTTPS with certbot:

```bash
sudo certbot --nginx -d trader.yourdomain.com
```

## Firewall

```bash
# If exposing the port directly (no reverse proxy)
sudo ufw allow 3002/tcp

# If using Nginx reverse proxy, only open 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Updating

```bash
cd hyperliquid-copy-trader
git pull
docker compose up -d --build
```
