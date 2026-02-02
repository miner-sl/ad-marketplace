# Project Overview

## Ad Marketplace - Telegram Mini App Backend

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
