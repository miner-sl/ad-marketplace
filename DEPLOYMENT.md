# Deployment Guide

This guide covers deploying the Ad Marketplace application to production.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ (or use Docker Compose)
- Node.js 18+ (for local development)
- Telegram Bot Token
- TON API credentials (optional, for mainnet)

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Server
PORT=3000
NODE_ENV=production

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Database
DATABASE_URL=postgresql://user:password@host:5432/ad_marketplace
# OR use individual components:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ad_marketplace
DB_USER=admarketplace
DB_PASSWORD=your_secure_password

# TON Network
TON_NETWORK=mainnet  # or 'testnet' for testing
TON_API_KEY=your_ton_api_key
TON_WALLET_MNEMONIC=your_wallet_mnemonic_here

# Deal Settings
DEAL_TIMEOUT_HOURS=72
MIN_POST_DURATION_HOURS=24

# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_DIR=logs

# Security (optional)
ALLOWED_ORIGINS=https://your-domain.com,https://another-domain.com
```

## Production Deployment with Docker Compose

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ad-marketplace
cp .env.example .env
# Edit .env with your production values
```

### 2. Build and Start Services

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 3. Run Database Migrations

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run migrate:run
```

### 4. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# Readiness check (includes database)
curl http://localhost:3000/ready

# Liveness check
curl http://localhost:3000/live
```

### 5. Set Telegram Webhook

The application will automatically set the webhook on startup if `TELEGRAM_WEBHOOK_URL` is set.

Alternatively, set it manually:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-domain.com/webhook"
```

## Manual Deployment (Without Docker)

### 1. Install Dependencies

```bash
npm ci --only=production
```

### 2. Build Application

```bash
npm run build
```

### 3. Setup Database

```bash
# Create database
createdb ad_marketplace

# Run migrations
npm run migrate:run
```

### 4. Start Application

```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start dist/index.js --name ad-marketplace

# Or using systemd
# See systemd service file example below
```

### 5. Setup Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 60s;
    }
}
```

## Systemd Service File

Create `/etc/systemd/system/ad-marketplace.service`:

```ini
[Unit]
Description=Ad Marketplace Application
After=network.target postgresql.service

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/ad-marketplace
Environment=NODE_ENV=production
EnvironmentFile=/opt/ad-marketplace/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ad-marketplace
sudo systemctl start ad-marketplace
sudo systemctl status ad-marketplace
```

## Monitoring and Logging

### Log Files

Logs are stored in the `logs/` directory:
- `error.log` - Error level logs
- `combined.log` - All logs
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

### Health Checks

The application provides three health check endpoints:

- `/health` - Basic health check
- `/ready` - Readiness check (includes database connectivity)
- `/live` - Liveness check

Use these endpoints for:
- Kubernetes liveness/readiness probes
- Load balancer health checks
- Monitoring systems

### Monitoring Recommendations

1. **Application Monitoring**: Use tools like Prometheus + Grafana or Datadog
2. **Error Tracking**: Integrate Sentry or similar service
3. **Log Aggregation**: Use ELK stack, Loki, or cloud logging services
4. **Database Monitoring**: Monitor PostgreSQL performance and connections

## Backup and Recovery

### Database Backups

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U admarketplace ad_marketplace > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U admarketplace ad_marketplace < backup.sql
```

### Automated Backups

Set up a cron job for regular backups:

```bash
0 2 * * * docker-compose -f /path/to/docker-compose.prod.yml exec -T postgres pg_dump -U admarketplace ad_marketplace | gzip > /backups/backup_$(date +\%Y\%m\%d).sql.gz
```

## Security Checklist

- [ ] Use strong database passwords
- [ ] Enable SSL/TLS for database connections in production
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Use HTTPS for webhook URL
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Use secrets management (e.g., Docker secrets, AWS Secrets Manager)
- [ ] Enable firewall rules
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity

## Scaling

### Horizontal Scaling

For high traffic, consider:

1. **Load Balancer**: Use Nginx or cloud load balancer
2. **Multiple Instances**: Run multiple app instances behind load balancer
3. **Database Connection Pooling**: Already configured in the app
4. **Caching**: Add Redis for caching (future enhancement)

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize database queries
- Add database read replicas

## Troubleshooting

### Application Won't Start

1. Check logs: `docker-compose -f docker-compose.prod.yml logs app`
2. Verify environment variables
3. Check database connectivity
4. Verify port availability

### Database Connection Issues

1. Check database is running: `docker-compose -f docker-compose.prod.yml ps postgres`
2. Verify `DATABASE_URL` or individual DB variables
3. Check network connectivity
4. Review database logs

### Bot Not Responding

1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Check webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Check application logs for errors
4. Verify webhook URL is accessible from internet

## Rollback Procedure

1. Stop current version:
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. Restore previous version:
   ```bash
   git checkout <previous-version-tag>
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. Restore database backup if needed:
   ```bash
   docker-compose -f docker-compose.prod.yml exec -T postgres psql -U admarketplace ad_marketplace < backup.sql
   ```

## Support

For issues or questions:
- Check application logs
- Review GitHub issues
- Contact support team
