# Ad Marketplace - Telegram Mini App Backend

A Node.js backend for a Telegram Mini App marketplace connecting channel owners and advertisers with TON blockchain escrow functionality.

## Features
- [X] distributed lock (redis)
- [X] jwt auth
- [X] channel topic
- [ ] role [admin moderator, channel owner, ads buyer]
- [ ] channel verification and advertiser verification
- [ ] use tg stats for gather stats
- [ ] recheck every 30 days admin rights user + bot , subs count, 
- [ ] transactions history
- [ ] integrate i18n
- [ ] channel topic, geo/country, language, budget range, format
- [ ] SEARCH: vectorize channels fields and sort relevance by cosine distance
- [ ] store images before publish
- [ ] dashboard (revenue by month, channel page views, in favorites, in favorites, placemnets, earned)
- [ ] transaction history 
- [ ] marketplace catalog with basket or fast buy flow (select type, place order, wait moderation)
- [ ] super admin for moderate channels
- [ ] Store escrow wallet secret in KMS/HSM/encrypted at database (?)
- [ ] sick ui
- [ ] tg notification queue (?)
- [ ] ads payments by advertiser (integrate tonconnect)
- [ ] scheduler post verification, auto publication
- [ ] support all telegram message entities in post (emoji, animated/premium emoji, markdown formatting and etc)
https://core.telegram.org/type/MessageEntity
- [ ] fix transactions operation
- [ ] telegram post analytics
- [ ] use usdt for prices
- [ ] refunds/release funds in ton
- [ ] Release funds to channel owner check transaction really exist
- [ ] /check payments without mock transactions
- [ ] setup post publication time
- [ ] check edit post text,
- [ ] attach media, photos, formatted with telegram entities
- [ ] mini app
- [ ] check that user really admin before send to their address money
- [ ] deploy to vps workflow


## Features

- **Dual Marketplace Model**: Both channel owner listings and advertiser campaign requests
- **Verified Channel Stats**: Automatic fetching and caching of Telegram channel statistics
- **Flexible Ad Formats**: Support for posts, forwards, stories, and custom formats with per-format pricing
- **TON Escrow System**: Secure payment handling with automatic fund release/refund
- **Creative Approval Workflow**: Complete approval loop from brief to published post
- **Auto-posting**: Automated posting with verification to ensure content stays live
- **Deal Lifecycle Management**: Timeouts, status transitions, and automatic cancellation
- **PR Manager Support**: Multi-user channel management with admin verification

## Architecture

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Telegram**: Telegraf + node-telegram-bot-api
- **Blockx1hain**: TON (The Open Network)
- **Task Scheduling**: node-cron

### Project Structure

```
src/
├── db/              # Database schema and connection
├── models/          # Data models (User, Channel, Deal, etc.)
├── services/        # Business logic services
│   ├── telegram.ts  # Telegram API integration
│   ├── ton.ts       # TON blockchain integration
│   ├── creative.ts  # Creative management
│   └── dealFlow.ts  # Deal workflow orchestration
├── routes/          # Express API routes
│   ├── channels.ts
│   ├── deals.ts
│   └── campaigns.ts
├── bot/             # Telegram bot handlers
├── cron/            # Scheduled jobs (auto-post, verification, etc.)
└── index.ts         # Main server entry point
```

### Key Components

#### 1. Database Schema

- **Users**: Telegram users (channel owners, advertisers)
- **Channels**: Channel listings with stats and pricing
- **Channel Managers**: PR managers with permissions
- **Channel Stats**: Cached Telegram analytics
- **Channel Pricing**: Per-format pricing configuration
- **Campaigns**: Advertiser campaign briefs
- **Channel Listings**: Channel owner offers
- **Deals**: Unified deal workflow (converges listings and campaigns)
- **Deal Messages**: Negotiation messages via bot
- **Creatives**: Creative submissions and approvals
- **Post Verifications**: Post verification logs

#### 2. Deal Flow

```
pending → negotiating → approved → payment_pending → paid 
  → creative_submitted → creative_approved → scheduled 
  → posted → verified → completed
```

Alternative paths:
- `cancelled` (timeout or manual)
- `refunded` (verification failed)

#### 3. Escrow Flow

1. Advertiser initiates deal → escrow address generated
2. Advertiser sends TON to escrow address
3. Payment confirmed on-chain → deal status: `paid`
4. Channel owner submits creative → advertiser approves
5. Creative auto-posted → deal status: `posted`
6. After verification period (24h default) → verify post exists
7. If verified: release funds to channel owner
8. If not verified: refund to advertiser

#### 4. Auto-posting & Verification

- Cron job checks for scheduled posts every 5 minutes
- Posts approved creatives automatically
- Verification job runs hourly to check posted deals
- Verifies post exists and is unchanged
- Releases or refunds based on verification result

## Setup & Installation

### Prerequisites

- Node.js 18+ (or Docker & Docker Compose)
- PostgreSQL 12+ (or use Docker Compose)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- TON API key (from [TON Center](https://toncenter.com) or similar)

### Option 1: Docker Compose (Recommended)

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd ad-marketplace
   ```

2. **Set up environment variables**
   ```bash
   cp .env.docker.example .env
   # Edit .env with your configuration (at minimum: TELEGRAM_BOT_TOKEN, TON_API_KEY)
   ```

3. **Start services**
   ```bash
   # Start PostgreSQL and app
   docker-compose up -d
   
   # View logs
   docker-compose logs -f app
   ```

4. **Run migrations** (first time only)
   ```bash
   docker-compose exec app npm run migrate
   ```

5. **Access the application**
   - API: http://localhost:3000
   - PostgreSQL: localhost:5432

**Stop services:**
```bash
docker-compose down
```

**Stop and remove volumes (clean slate):**
```bash
docker-compose down -v
```

### Option 2: Local Development

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd ad-marketplace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb ad_marketplace
   
   # Or use Docker for just PostgreSQL:
   docker-compose up -d postgres
   
   # Run migrations
   npm run migrate
   ```

5. **Build TypeScript**
   ```bash
   npm run build
   ```

6. **Start server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Environment Variables

See `.env.example` for all required variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `DATABASE_URL`: PostgreSQL connection string
- `TON_NETWORK`: `testnet` or `mainnet`
- `TON_API_KEY`: TON API key for blockchain queries
- `DEAL_TIMEOUT_HOURS`: Deal timeout (default: 72)
- `MIN_POST_DURATION_HOURS`: Minimum post duration before release (default: 24)

## API Документация

### Swagger UI

Интерактивная документация API доступна по адресу:
- **Development**: http://localhost:3000/api-docs
- **Production**: https://your-domain.com/api-docs

### Документация

- **[API.md](./API.md)** - Краткая документация с примерами curl запросов
- **[swagger.yaml](./swagger.yaml)** - OpenAPI спецификация

### Основные эндпоинты

**Channels:**
- `GET /api/channels` - Список каналов
- `GET /api/channels/:id` - Информация о канале
- `POST /api/channels` - Регистрация канала
- `POST /api/channels/:id/pricing` - Установить цену
- `POST /api/channels/:id/refresh-stats` - Обновить статистику

**Deals:**
- `GET /api/deals` - Список сделок
- `GET /api/deals/:id` - Информация о сделке
- `POST /api/deals` - Создать сделку
- `POST /api/deals/:id/accept` - Принять сделку
- `POST /api/deals/:id/payment` - Подтвердить оплату
- `POST /api/deals/:id/creative` - Отправить креатив
- `POST /api/deals/:id/creative/approve` - Утвердить креатив
- `POST /api/deals/:id/schedule` - Запланировать публикацию

**Campaigns:**
- `GET /api/campaigns` - Список кампаний
- `GET /api/campaigns/:id` - Информация о кампании
- `POST /api/campaigns` - Создать кампанию
- `PUT /api/campaigns/:id` - Обновить кампанию

## Telegram Bot Commands

- `/start` - Start using the bot
- `/help` - Show help message
- `/mydeals` - View your deals
- `/mychannels` - View your channels
- `/mycampaigns` - View your campaigns
- `/deal <id>` - View deal details

## Deployment
### Docker Production Deployment

1. **Set up production environment**
   ```bash
   cp .env.docker.example .env
   # Fill in production values
   ```

2. **Build and start**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **Run migrations**
   ```bash
   docker-compose -f docker-compose.prod.yml exec app npm run migrate
   ```

### Webhook Setup (Production)

Set webhook URL in `.env`:
```
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
```

The server will automatically set the webhook on startup in production mode.

### Database Migrations

#### Initial Schema Setup
Run initial schema migration (first time only):
```bash
# Local
npm run migrate

# Docker
docker-compose exec app npm run migrate
```

#### Running Incremental Migrations
For adding new fields or tables to existing databases:
```bash
# Local
npm run migrate:run

# Docker
docker-compose exec app npm run migrate:run
```

#### Quick Fix: Add Missing wallet_address Field
If you get an error about missing `wallet_address` column, you can run this SQL directly:
```bash
# Option 1: Run migration script
npm run migrate:run

# Option 2: Run SQL directly
psql -U your_user -d your_database -f src/db/add_wallet_address.sql

# Option 3: Execute SQL manually
psql -U your_user -d your_database
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS channel_owner_wallet_address VARCHAR(255);
```

### Environment

Set `NODE_ENV=production` for production deployment.

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Access database
docker-compose exec postgres psql -U admarketplace -d ad_marketplace

# Run migrations
docker-compose exec app npm run migrate

# Execute commands in app container
docker-compose exec app npm run <command>
```

## Key Design Decisions

1. **Unified Deal Flow**: Both channel listings and advertiser campaigns converge into a single deal workflow, simplifying implementation and ensuring consistent behavior.

2. **Escrow Per Deal**: Each deal gets its own escrow address for security and transparency. Alternative: per-user wallets (hot wallet) for efficiency.

3. **Text Bot for Messaging**: Deal negotiations happen via text bot rather than mini-app chat, keeping the implementation simple and accessible.

4. **Admin Verification**: Before financial operations, the system re-verifies that users are still admins of their channels, preventing unauthorized actions.

5. **Post Verification**: After posting, the system waits a minimum duration (24h default) and verifies the post still exists before releasing funds, protecting advertisers.

6. **Cron-based Automation**: Auto-posting and verification run as scheduled jobs, ensuring reliability without complex event systems.

## Known Limitations & Future Improvements

### Current Limitations

1. **Channel Stats**: Detailed stats (average views, language distribution, premium stats) require Telegram Premium API access. MVP uses basic member count.

2. **TON Integration**: Escrow wallet generation and transaction signing are simplified for MVP. Production would need:
   - Proper mnemonic generation
   - Secure key management

3. **Post Verification**: Current verification is simplified (checks existence only). Production should:
   - Store message content on post
   - Compare content for changes
   - Handle edge cases (edited posts, etc.)

4. **PR Manager Flow**: Admin fetching and permission management is basic. Production should:
   - Real-time admin verification
   - Admin change notifications

### Future Enhancements
3. **Advanced Analytics**: Integration with Telegram Analytics API for detailed stats
3. **Multi-currency Support**: Support for other cryptocurrencies
4. **Rating System**: Channel and advertiser ratings/reviews
5. **Automated Matching**: AI-powered matching of campaigns to channels
6. **Bulk Deals**: Support for multi-channel campaigns
7. **Advanced Filters**: More sophisticated search and filtering
8. **Notifications**: Real-time push notifications for deal updates
9. **Mini-App Frontend**: Full-featured Telegram Mini App UI
10. **Analytics Dashboard**: Channel performance analytics

## Testing

```bash
# Run tests (when implemented)
npm test
```
