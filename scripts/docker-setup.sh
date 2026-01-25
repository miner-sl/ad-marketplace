#!/bin/bash

# Docker setup script for Ad Marketplace

echo "🐳 Setting up Ad Marketplace with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker.example..."
    cp .env.docker.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   Required: TELEGRAM_BOT_TOKEN, TON_API_KEY"
    echo ""
    read -p "Press enter after you've configured .env file..."
fi

# Start services
echo "🚀 Starting Docker services..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is healthy
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U admarketplace > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start. Check logs: docker-compose logs postgres"
        exit 1
    fi
    sleep 1
done

# Run migrations
echo "🗄️  Running database migrations..."
docker-compose exec app npm run migrate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "Services are running:"
    echo "  - API: http://localhost:3000"
    echo "  - PostgreSQL: localhost:5432"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Stop services: docker-compose down"
    echo "  - Restart: docker-compose restart"
else
    echo "❌ Migration failed. Check logs: docker-compose logs app"
    exit 1
fi
