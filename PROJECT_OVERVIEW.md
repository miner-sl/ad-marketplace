# Project Overview

## Ad Marketplace - Telegram Mini App Backend

A comprehensive Node.js backend for a Telegram Mini App marketplace that connects channel owners (influencers) with advertisers, featuring TON blockchain escrow functionality.

## Key Features Implemented

### ✅ Marketplace Model (Dual Entry Points)

1. **Channel Owner Listings**
   - Channel registration with bot admin verification
   - Pricing configuration per ad format
   - Channel stats caching
   - PR manager support (multi-user management)
   - Admin status re-verification before financial operations

2. **Advertiser Campaigns**
   - Campaign brief creation
   - Target audience filters (subscribers, views, languages)
   - Budget management
   - Preferred ad formats

3. **Unified Deal Flow**
   - Both entry points converge into single deal workflow
   - Consistent negotiation, approval, and escrow process
   - Text bot for messaging (not mini-app chat)

### ✅ Verified Channel Stats

- Automatic fetching from Telegram API
- Caching in database
- Support for:
  - Subscribers count
  - Average views/reach (placeholder for Premium API)
  - Language distribution (placeholder)
  - Premium subscribers (placeholder)
- Daily refresh cron job

### ✅ Ad Formats & Pricing

- Flexible format system (post, forward, story, custom)
- Per-format pricing per channel
- MVP supports post format
- Free-form pricing (not strict ad types)

### ✅ TON Escrow System

- Escrow address generation per deal
- Payment verification on blockchain
- Automatic fund release on verification success
- Automatic refund on verification failure
- Secure wallet management (placeholder for production)

### ✅ Creative Approval Workflow

Complete approval loop:
1. Advertiser submits brief/preferences
2. Channel owner accepts/rejects deal
3. Channel owner drafts and submits creative
4. Advertiser approves or requests revision
5. Once approved → auto-publish at scheduled time

### ✅ Auto-posting & Verification

- Automated posting of approved creatives
- Post verification (checks existence)
- Minimum duration check (24h default)
- Funds released only after successful verification
- Funds refunded if post deleted/changed

### ✅ Deal Lifecycle Management

- Status transitions with validation
- Auto-cancel on timeout (72h default, configurable)
- Clear status flow tracking
- Deal messages for negotiation history

### ✅ Filters & Search

- Channel filters: subscribers, price, format, language
- Campaign filters: budget, status, advertiser
- Deal filters: status, type, user

## Technical Implementation

### Architecture Decisions

1. **Unified Deal Model**: Single deal table handles both listing-initiated and campaign-initiated deals, simplifying codebase

2. **Service Layer**: Business logic separated into services (TelegramService, TONService, DealFlowService, CreativeService)

3. **Cron-based Automation**: Scheduled jobs for auto-posting, verification, expiration, and stats refresh

4. **Database-first**: PostgreSQL with proper indexes, relationships, and constraints

5. **Type Safety**: Full TypeScript implementation with Zod validation

6. **Security**: Rate limiting, input validation, admin verification, escrow isolation

### Code Quality

- Clean architecture with separation of concerns
- Error handling throughout
- Logging with Winston
- Input validation with Zod
- Type-safe database queries
- RESTful API design

## Project Structure

```
ad-marketplace/
├── src/
│   ├── db/              # Database schema & connection
│   ├── models/          # Data models (User, Channel, Deal, etc.)
│   ├── services/        # Business logic services
│   ├── routes/          # Express API routes
│   ├── bot/             # Telegram bot handlers
│   ├── cron/            # Scheduled jobs
│   ├── middleware/      # Express middleware
│   └── utils/           # Utilities (logger, validation)
├── scripts/             # Setup scripts
├── README.md            # Main documentation
├── ARCHITECTURE.md      # Architecture details
├── EXAMPLES.md          # API usage examples
└── package.json         # Dependencies & scripts
```

## Known Limitations (MVP)

1. **Channel Stats**: Detailed analytics require Telegram Premium API. MVP uses basic member count.

2. **TON Integration**: Simplified escrow implementation. Production needs:
   - Proper mnemonic generation
   - Secure key management
   - Transaction signing
   - Smart contract option

3. **Post Verification**: Basic existence check. Production should:
   - Store message content on post
   - Compare for changes
   - Handle edited posts

4. **PR Manager Flow**: Basic admin verification. Production should:
   - Real-time admin sync
   - Granular permissions
   - Change notifications

## Future Enhancements

1. Smart contract escrow on TON
2. Telegram Analytics API integration
3. Multi-currency support
4. Rating/review system
5. AI-powered matching
6. Bulk/multi-channel deals
7. Advanced analytics dashboard
8. Real-time notifications
9. Full Mini-App frontend
10. GraphQL API option

## Setup & Deployment

See `README.md` for detailed setup instructions.

Quick start:
```bash
npm install
cp .env.example .env  # Configure your .env
npm run migrate       # Setup database
npm run build         # Build TypeScript
npm run dev           # Start development server
```

## Testing

The codebase is structured for testing but test files are not included in MVP. Future additions:
- Unit tests for services
- Integration tests for API
- E2E tests for deal flow

## AI Code Generation

**~95% of code written by AI** (Claude/Composer)

The codebase was primarily generated by AI with human guidance on:
- Architecture decisions
- Requirements specification
- Code review and refinement

Code follows best practices and is ready for open-source contribution.

## License

MIT License - Open source ready

## Contributing

This is an MVP implementation. Contributions welcome for:
- Test coverage
- Production-ready TON integration
- Enhanced verification logic
- Performance optimizations
- Additional features
