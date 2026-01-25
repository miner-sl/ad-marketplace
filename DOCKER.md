# Docker Setup Guide

## Quick Start

### Development

1. **Copy environment file**
   ```bash
   cp .env.docker.example .env
   ```

2. **Edit `.env`** and add your:
   - `TELEGRAM_BOT_TOKEN`
   - `TON_API_KEY`
   - Other configuration as needed

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Run migrations** (first time only)
   ```bash
   docker-compose exec app npm run migrate
   ```

5. **View logs**
   ```bash
   docker-compose logs -f app
   ```

### Production

1. **Set up production environment**
   ```bash
   cp .env.docker.example .env
   # Fill in production values
   ```

2. **Start with production compose file**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **Run migrations**
   ```bash
   docker-compose -f docker-compose.prod.yml exec app npm run migrate
   ```

## Docker Services

### PostgreSQL

- **Port**: 5432
- **User**: admarketplace
- **Password**: admarketplace123 (change in production!)
- **Database**: ad_marketplace
- **Volume**: `postgres_data` (persists data)

### Node.js App

- **Port**: 3000
- **Environment**: Development (hot reload) or Production
- **Volumes**: 
  - `./src` - Source code (for hot reload in dev)
  - `./dist` - Built files
  - `/app/node_modules` - Dependencies

## Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# View logs
docker-compose logs -f app
docker-compose logs -f postgres

# Rebuild after code changes
docker-compose up -d --build

# Access PostgreSQL CLI
docker-compose exec postgres psql -U admarketplace -d ad_marketplace

# Run migrations
docker-compose exec app npm run migrate

# Execute npm commands in app container
docker-compose exec app npm run <command>

# Access app container shell
docker-compose exec app sh
```

## Database Connection

The app automatically connects to PostgreSQL using:
- **Development**: `postgresql://admarketplace:admarketplace123@postgres:5432/ad_marketplace`
- **Production**: Uses environment variables from `.env`

You can override the connection string with `DATABASE_URL` in `.env`.

## Troubleshooting

### Database connection errors

1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify database exists:
   ```bash
   docker-compose exec postgres psql -U admarketplace -l
   ```

### App won't start

1. Check app logs:
   ```bash
   docker-compose logs app
   ```

2. Verify environment variables:
   ```bash
   docker-compose exec app env | grep -E 'TELEGRAM|TON|DATABASE'
   ```

3. Rebuild containers:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### Migration issues

1. Run migrations manually:
   ```bash
   docker-compose exec app npm run migrate
   ```

2. Check if tables exist:
   ```bash
   docker-compose exec postgres psql -U admarketplace -d ad_marketplace -c "\dt"
   ```

## Volume Persistence

Data is persisted in Docker volumes:
- `postgres_data`: PostgreSQL data files
- These persist even when containers are stopped

To start fresh:
```bash
docker-compose down -v
docker-compose up -d
docker-compose exec app npm run migrate
```

## Network

Services communicate via Docker network `ad-marketplace-network`:
- App connects to PostgreSQL using service name `postgres`
- No need to expose PostgreSQL port externally (unless needed)

## Health Checks

PostgreSQL has a health check configured. The app waits for PostgreSQL to be healthy before starting.

## Production Considerations

1. **Change default passwords** in `.env`
2. **Use strong database credentials**
3. **Set up SSL** for database connections
4. **Use secrets management** (Docker secrets, etc.)
5. **Set up backups** for PostgreSQL volume
6. **Configure resource limits** in docker-compose
7. **Use reverse proxy** (nginx, traefik) for HTTPS
8. **Set up monitoring** and logging
