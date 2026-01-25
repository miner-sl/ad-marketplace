#!/bin/bash

# Setup script for Ad Marketplace backend

echo "🚀 Setting up Ad Marketplace backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 12+ first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   Required: TELEGRAM_BOT_TOKEN, DATABASE_URL, TON_API_KEY"
    exit 1
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Run migrations
echo "🗄️  Running database migrations..."
npm run migrate

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env file is configured correctly"
echo "2. Start the server: npm run dev (development) or npm start (production)"
echo "3. Set up webhook in production: Set TELEGRAM_WEBHOOK_URL in .env"
