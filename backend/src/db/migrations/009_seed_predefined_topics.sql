-- Migration: Seed predefined Telegram channel topics
-- Date: 2026-02-02
-- Description: Inserts general predefined topics for Telegram channels

-- Insert predefined topics (using INSERT ... ON CONFLICT to avoid duplicates)
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

-- Verify topics were inserted
DO $$
DECLARE
  topic_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO topic_count FROM topics;
  RAISE NOTICE 'Total topics in database: %', topic_count;
END $$;
