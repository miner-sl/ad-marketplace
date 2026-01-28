-- Users table (Telegram users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    wallet_address VARCHAR(255), -- TON wallet address for receiving payments
    is_channel_owner BOOLEAN DEFAULT FALSE,
    is_advertiser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_channel_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    bot_admin_id BIGINT, -- Telegram bot ID added as admin
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel managers (PR managers)
CREATE TABLE IF NOT EXISTS channel_managers (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, telegram_user_id)
);

-- Channel stats (cached from Telegram)
CREATE TABLE IF NOT EXISTS channel_stats (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    subscribers_count INTEGER,
    average_views INTEGER,
    average_reach INTEGER,
    language_distribution JSONB,
    premium_subscribers_count INTEGER,
    stats_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ad formats and pricing
CREATE TABLE IF NOT EXISTS channel_pricing (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    ad_format VARCHAR(50) NOT NULL, -- 'post', 'forward', 'story', etc.
    price_ton DECIMAL(20, 9) NOT NULL,
    currency VARCHAR(10) DEFAULT 'TON',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, ad_format)
);

-- Campaigns (Advertiser requests)
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    advertiser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    budget_ton DECIMAL(20, 9),
    target_subscribers_min INTEGER,
    target_subscribers_max INTEGER,
    target_views_min INTEGER,
    target_languages JSONB,
    preferred_formats JSONB, -- ['post', 'story']
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'closed', 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Channel listings (Channel owner offers)
CREATE TABLE IF NOT EXISTS channel_listings (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deals (unified workflow)
CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    deal_type VARCHAR(50) NOT NULL, -- 'listing' (channel owner initiated) or 'campaign' (advertiser initiated)
    listing_id INTEGER REFERENCES channel_listings(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    channel_owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    advertiser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_format VARCHAR(50) NOT NULL,
    price_ton DECIMAL(20, 9) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'negotiating', 'approved', 'payment_pending', 'paid', 'creative_submitted', 'creative_approved', 'scheduled', 'posted', 'verified', 'completed', 'cancelled', 'refunded'
    channel_owner_wallet_address VARCHAR(255), -- Channel owner's wallet address for receiving payments
    escrow_address VARCHAR(255), -- TON wallet address for this deal
    payment_tx_hash VARCHAR(255),
    payment_confirmed_at TIMESTAMP,
    scheduled_post_time TIMESTAMP,
    actual_post_time TIMESTAMP,
    post_message_id BIGINT,
    post_verification_until TIMESTAMP,
    timeout_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deal messages (negotiation via bot)
CREATE TABLE IF NOT EXISTS deal_messages (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creative submissions
CREATE TABLE IF NOT EXISTS creatives (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- 'text', 'photo', 'video', 'document', etc.
    content_data JSONB NOT NULL, -- {text, photo_file_id, etc.}
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'rejected', 'needs_revision'
    revision_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post verification logs
CREATE TABLE IF NOT EXISTS post_verifications (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    post_exists BOOLEAN,
    post_unchanged BOOLEAN,
    message_id BIGINT,
    verification_result JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_channels_owner_id ON channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_channels_telegram_id ON channels(telegram_channel_id);
CREATE INDEX IF NOT EXISTS idx_deals_channel_id ON deals(channel_id);
CREATE INDEX IF NOT EXISTS idx_deals_advertiser_id ON deals(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_timeout_at ON deals(timeout_at);
CREATE INDEX IF NOT EXISTS idx_deals_scheduled_post_time ON deals(scheduled_post_time);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser_id ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_channel_stats_channel_id ON channel_stats(channel_id);
