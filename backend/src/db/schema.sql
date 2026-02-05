-- Users table (Telegram users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    photo_url VARCHAR(500), -- Telegram user photo URL
    language_code VARCHAR(10), -- Telegram user language code
    is_premium BOOLEAN DEFAULT FALSE, -- Telegram Premium status
    wallet_address VARCHAR(255), -- TON wallet address for receiving payments
    is_channel_owner BOOLEAN DEFAULT FALSE,
    is_advertiser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topics table (predefined topics for channels)
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined topics
INSERT INTO topics (id, name, description) VALUES
  (1, 'Technology', 'Tech news, gadgets, software, programming, AI, and innovation'),
  (2, 'Business & Finance', 'Business news, finance, investing, entrepreneurship, and economics'),
  (3, 'News & Media', 'Breaking news, current events, journalism, and media updates'),
  (4, 'Entertainment', 'Movies, TV shows, celebrities, pop culture, and entertainment news'),
  (5, 'Gaming', 'Video games, esports, gaming news, reviews, and gaming communities'),
  (6, 'Education', 'Learning, courses, tutorials, academic content, and educational resources'),
  (7, 'Health & Fitness', 'Health tips, fitness, nutrition, wellness, and medical advice'),
  (8, 'Lifestyle', 'Daily life, personal development, productivity, and lifestyle tips'),
  (9, 'Travel', 'Travel guides, destinations, tips, photography, and travel experiences'),
  (10, 'Food & Cooking', 'Recipes, cooking tips, restaurant reviews, and culinary content'),
  (11, 'Fashion & Beauty', 'Fashion trends, beauty tips, style guides, and cosmetics'),
  (12, 'Sports', 'Sports news, matches, athletes, teams, and sports analysis'),
  (13, 'Crypto & Blockchain', 'Cryptocurrency, blockchain technology, DeFi, NFTs, and trading'),
  (14, 'Marketing & Advertising', 'Marketing strategies, advertising, branding, and digital marketing'),
  (15, 'Real Estate', 'Property listings, real estate news, investment, and market trends'),
  (16, 'Automotive', 'Cars, motorcycles, automotive news, reviews, and vehicle maintenance'),
  (17, 'Music', 'Music news, artists, albums, concerts, and music industry'),
  (18, 'Art & Design', 'Visual arts, design, illustration, photography, and creative content'),
  (19, 'Science', 'Scientific discoveries, research, space, nature, and educational science'),
  (20, 'Politics', 'Political news, analysis, elections, and government affairs'),
  (21, 'Comedy & Humor', 'Funny content, memes, jokes, and entertainment humor'),
  (22, 'Pets & Animals', 'Pet care, animal content, pet training, and animal welfare'),
  (23, 'Home & Garden', 'Home improvement, interior design, gardening, and DIY projects'),
  (24, 'Parenting & Family', 'Parenting tips, family life, child development, and family activities'),
  (25, 'Photography', 'Photography techniques, equipment, photo editing, and visual storytelling'),
  (26, 'Books & Literature', 'Book reviews, reading recommendations, authors, and literary content'),
  (27, 'Podcasts & Audio', 'Podcast recommendations, audio content, and audio production'),
  (28, 'Motivation & Self-Improvement', 'Personal growth, motivation, success stories, and self-help'),
  (29, 'Local & Regional', 'Local news, regional content, community updates, and city-specific channels'),
  (30, 'Hobbies & Interests', 'Various hobbies, interests, and niche communities')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_channel_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
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
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'negotiating', 'approved', 'payment_pending', 'paid', 'creative_submitted', 'creative_approved', 'scheduled', 'posted', 'verified', 'completed', 'declined', 'refunded'
    decline_reason TEXT, -- Reason for deal decline/cancellation
    channel_owner_wallet_address VARCHAR(255), -- Channel owner's wallet address for receiving payments
    escrow_address VARCHAR(255), -- TON wallet address for this deal
    payment_tx_hash VARCHAR(255),
    payment_confirmed_at TIMESTAMP,
    scheduled_post_time TIMESTAMP,
    actual_post_time TIMESTAMP,
    post_message_id BIGINT,
    post_verification_until TIMESTAMP,
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
-- Note: Index for topic_id is created in migration 008_add_topics_table_and_channel_topic.sql
-- when the topic_id column is added. It's not created here to avoid errors if column doesn't exist yet.
CREATE INDEX IF NOT EXISTS idx_deals_channel_id ON deals(channel_id);
CREATE INDEX IF NOT EXISTS idx_deals_advertiser_id ON deals(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_scheduled_post_time ON deals(scheduled_post_time);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser_id ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_channel_stats_channel_id ON channel_stats(channel_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_unique_payment_tx_hash
ON deals(id, payment_tx_hash)
WHERE payment_tx_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_unique_post_message_id
ON deals(id, post_message_id)
WHERE post_message_id IS NOT NULL;
