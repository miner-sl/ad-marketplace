# Ad Marketplace - Telegram Mini App Backend

[@NonNano_bot](https://t.me/NonNano_Bot)

## Setup & Installation

### Local Development

See `backend/.env.docker.example` for all required variables:

- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (get at bot farther)
- `JWT_SECRET`
- `DATABASE_URL`: PostgreSQL connection string
- `TON_NETWORK`: `testnet` or `mainnet`
- `TON_API_KEY`: TON API key for blockchain queries
- `DEAL_TIMEOUT_HOURS`: Deal timeout (default: 72)
- `MIN_POST_DURATION_HOURS`: Minimum post duration before release (default: 24)

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd ad-marketplace
   ```

2. **Install dependencies**
   ```bash
   cd backend && npm install
   cp .env.example .env
   cd ../front && npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   cd .. && docker-compose up -d
   ```

5**Start server**

   ```bash
   # Development
   cd backend && npm run dev
   cd front && npm run dev:https
   ```

5**Open telegram mini app at web.telegram.org/a**

```bash
1. at bot farther setup url to frontend.
 something like that `Network: https://192.168.31.146:5173/`
2. Open telegram mini app at web.telegram.org/a

```


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

### Webhook Setup (Production)

Set webhook URL in `.env`:

```
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
```

The server will automatically set the webhook on startup in production mode.

## Key Design Decisions

1. **Unified Deal Flow**: Both channel listings and advertiser campaigns converge into a single deal workflow,
   simplifying implementation and ensuring consistent behavior.

2. **Escrow Per Deal**: Each deal gets its own escrow address for security and transparency. Alternative: per-user
   wallets (hot wallet) for efficiency.

3. **Text Bot for Messaging**: Deal negotiations happen via text bot rather than mini-app chat, keeping the
   implementation simple and accessible.

4. **Admin Verification**: Before financial operations, the system re-verifies that users are still admins of their
   channels, preventing unauthorized actions.

5. **Post Verification**: After posting, the system waits a minimum duration (24h default) and verifies the post still
   exists before releasing funds, protecting advertisers.

6. **Cron-based Automation**: Auto-posting and verification run as scheduled jobs, ensuring reliability without complex
   event systems.

## Known Limitations & Future Improvements

### Current Limitations

1. **Channel Stats**: Detailed stats (average views, language distribution, premium stats) require Telegram Premium API
   access. MVP uses basic member count.

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

## Features

### 1. Done

- [X] distributed lock (redis)
- [X] jwt auth
- [X] channel topic
- [X] tg notification queue (?)
- [X] scheduler post verification, auto publication
- [X] setup post publication time
- [X] check that user really admin before send to their address money
- [X] channel topic

### 2. TODO

- [ ] connect wallet by channel owner
- [ ] scheduler for generate escrow wallet at ton
- [ ] role [admin moderator, channel owner, ads buyer]
- [ ] channel verification and advertiser verification
- [ ] use tg stats for gather stats
- [ ] recheck every 30 days admin rights user + bot , subs count,
- [ ] transactions history
- [ ] integrate i18n
- [ ] channel geo/country, language, budget range, format
- [ ] SEARCH: vectorize channels fields and sort relevance by cosine distance
- [ ] store images before publish
- [ ] dashboard (revenue by month, channel page views, in favorites, in favorites, placemnets, earned)
- [ ] transaction history
- [ ] channels catalog with basket or fast buy flow (select type, place order, wait moderation)
- [ ] super admin for moderate channels
- [ ] Store escrow wallet secret in KMS/HSM/encrypted at database (?)
- [ ] sleek ui
- [ ] ads payments by advertiser (integrate tonconnect)
- [ ] support all telegram message entities in post (emoji, animated/premium emoji, markdown formatting and etc)
  https://core.telegram.org/type/MessageEntity
- [ ] fix transactions operation
- [ ] telegram post analytics
- [ ] use usdt for prices
- [ ] refunds money to channel owner
- [ ] Release funds to channel owner check transaction really exist
- [ ] /check payments without mock transactions
- [ ] check edit post text,
- [ ] attach media, photos, formatted with telegram entities
- [ ] mini app
- [ ] deploy to vps workflow
