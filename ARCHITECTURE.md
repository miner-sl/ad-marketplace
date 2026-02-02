# Architecture Overview

## System Design

### High-Level Architecture

```
┌─────────────────┐
│  Telegram Bot   │
│   (Telegraf)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│  Express API    │◄────►│  PostgreSQL  │      │  TON Network│
│   Server        │      │   Database   │      │  (Escrow)   │
└─────────────────┘      └──────────────┘      └─────────────┘
         │
         ▼
┌─────────────────┐
│  Cron Jobs      │
│  (Auto-post,    │
│   Verification) │
│   Ton Indexer)  │
└─────────────────┘
```

## Data Flow

### Channel Registration Flow

1. User sends channel info via API or bot
2. System verifies bot is admin of channel
3. Fetches channel info from Telegram
4. Creates channel record in database
5. Fetches and caches channel stats
6. User sets pricing for ad formats

### Deal Creation Flow

**From Channel Listing:**
1. Advertiser browses channel listings
2. Advertiser creates deal from listing
3. System generates escrow address
4. Deal status: `pending`

**From Campaign:**
1. Advertiser creates campaign brief
2. Channel owners apply to campaign
3. Advertiser selects channel owner
4. System creates deal
5. Deal status: `pending`

### Deal Execution Flow

```
1. Deal Created (pending)
   ↓
2. Channel Owner Accepts (approved)
   ↓
3. Advertiser Pays to Escrow (paid)
   ↓
4. Channel Owner Submits Creative (creative_submitted)
   ↓
5. Advertiser Approves Creative (creative_approved)
   ↓
6. Schedule Post Time (scheduled)
   ↓
7. Auto-post Job Posts (posted)
   ↓
8. Verification Period (24h)
   ↓
9. Verification Job Checks (verified)
   ↓
10. Funds Released (completed)
```

### Escrow Flow

```
Advertiser Wallet
    │
    │ Send TON
    ▼
Escrow Address (per deal)
    │
    │ Verification passes
    ▼
Channel Owner Wallet
```

If verification fails:
```
Escrow Address
    │
    │ Refund
    ▼
Advertiser Wallet
```

## Database Design

### Core Entities

**Users**
- Telegram user information
- Roles: channel_owner, advertiser

**Channels**
- Channel metadata
- Linked to owner
- Has stats and pricing

**Deals**
- Central entity for all transactions
- Links channel, owner, advertiser
- Tracks status and escrow

**Creatives**
- Content submissions
- Approval workflow

### Relationships

```
User (1) ──< (N) Channel
User (1) ──< (N) Campaign
Channel (1) ──< (N) Deal
Campaign (1) ──< (N) Deal
Deal (1) ──< (1) Creative
Deal (1) ──< (N) DealMessage
```

## Security Considerations

1. **Admin Verification**: Before financial operations, re-verify user is still channel admin
2. **Escrow Isolation**: Each deal has its own escrow address
3. **Payment Verification**: Blockchain verification before status change
4. **Post Verification**: Verify post exists before releasing funds
5. **Rate Limiting**: API rate limits to prevent abuse
6. **Input Validation**: Zod schemas for all inputs

## Scalability Considerations

1. **Database Indexes**: Key fields indexed for performance
2. **Cron Jobs**: Background processing for heavy operations
3. **Caching**: Channel stats cached to reduce API calls
4. **Connection Pooling**: PostgreSQL connection pool
5. **Stateless API**: Stateless design for horizontal scaling

## Error Handling

- Try-catch blocks in all async operations
- Database transaction rollback on errors
- Graceful degradation (e.g., stats unavailable)
- Logging for debugging
- User-friendly error messages

## Future Enhancements

1. **Smart Contracts**: TON smart contracts for escrow
2. **WebSockets**: Real-time deal updates
3. **Caching Layer**: Redis for frequently accessed data
4. **Message Queue**: RabbitMQ/Kafka for async processing
5. **Microservices**: Split into smaller services
6. **GraphQL API**: More flexible querying
7. **Analytics**: Advanced analytics and reporting
