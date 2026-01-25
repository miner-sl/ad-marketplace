# API Usage Examples

## Channel Registration

```bash
# Register a channel
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 123456789,
    "telegram_channel_id": -1001234567890,
    "username": "my_channel",
    "first_name": "John",
    "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
  }'
```

## Set Channel Pricing

```bash
# Set price for post format
curl -X POST http://localhost:3000/api/channels/1/pricing \
  -H "Content-Type: application/json" \
  -d '{
    "ad_format": "post",
    "price_ton": "10.5"
  }'
```

## Create Campaign

```bash
# Create an advertiser campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 987654321,
    "title": "Tech Product Launch",
    "description": "Looking for tech channels with 10k+ subscribers",
    "budget_ton": "100",
    "target_subscribers_min": 10000,
    "preferred_formats": ["post"]
  }'
```

## Create Deal

```bash
# Create deal from listing
curl -X POST http://localhost:3000/api/deals \
  -H "Content-Type: application/json" \
  -d '{
    "deal_type": "listing",
    "listing_id": 1,
    "channel_id": 1,
    "channel_owner_id": 1,
    "advertiser_id": 2,
    "ad_format": "post",
    "price_ton": 10.5
  }'
```

## Accept Deal

```bash
# Channel owner accepts deal
curl -X POST http://localhost:3000/api/deals/1/accept \
  -H "Content-Type: application/json" \
  -d '{
    "channel_owner_id": 1
  }'
```

## Confirm Payment

```bash
# Advertiser confirms payment (after sending TON to escrow)
curl -X POST http://localhost:3000/api/deals/1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "0x1234567890abcdef..."
  }'
```

## Submit Creative

```bash
# Channel owner submits creative
curl -X POST http://localhost:3000/api/deals/1/creative \
  -H "Content-Type: application/json" \
  -d '{
    "channel_owner_id": 1,
    "content_type": "text",
    "content_data": {
      "text": "Check out our amazing product! 🚀"
    }
  }'
```

## Approve Creative

```bash
# Advertiser approves creative
curl -X POST http://localhost:3000/api/deals/1/creative/approve \
  -H "Content-Type: application/json" \
  -d '{
    "advertiser_id": 2
  }'
```

## Schedule Post

```bash
# Schedule post for specific time
curl -X POST http://localhost:3000/api/deals/1/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "post_time": "2026-01-26T10:00:00Z"
  }'
```

## List Channels with Filters

```bash
# Get channels with filters
curl "http://localhost:3000/api/channels?min_subscribers=10000&max_price=50&ad_format=post"
```

## Get Deal Details

```bash
# Get deal with messages and creative
curl http://localhost:3000/api/deals/1
```

## Telegram Bot Commands

```
/start - Start using the bot
/help - Show help
/mydeals - View your deals
/deal 123 - View deal #123 details
```

## Webhook Setup (Production)

```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook"
  }'
```

## Database Queries

```sql
-- Get all active deals
SELECT * FROM deals WHERE status NOT IN ('completed', 'cancelled', 'refunded');

-- Get deals ready for verification
SELECT * FROM deals 
WHERE status = 'posted' 
AND post_verification_until < CURRENT_TIMESTAMP;

-- Get channel stats
SELECT c.*, cs.subscribers_count, cs.average_views
FROM channels c
LEFT JOIN LATERAL (
  SELECT * FROM channel_stats 
  WHERE channel_id = c.id 
  ORDER BY stats_date DESC 
  LIMIT 1
) cs ON true
WHERE c.is_active = TRUE;
```
