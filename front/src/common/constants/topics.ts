/**
 * Predefined Telegram channel topics
 * These match the topics seeded in the database migration 009_seed_predefined_topics.sql
 *
 * This constant can be used by both backend and frontend to:
 * - Display topic options in UI
 * - Validate topic IDs
 * - Reference topics without database queries
 */

export interface Topic {
  id: number;
  name: string;
  description: string;
}

export const PREDEFINED_TOPICS: Topic[] = [
  { id: 1, name: 'Technology', description: 'Tech news, gadgets, software, programming, AI, and innovation' },
  { id: 2, name: 'Business & Finance', description: 'Business news, finance, investing, entrepreneurship, and economics' },
  { id: 3, name: 'News & Media', description: 'Breaking news, current events, journalism, and media updates' },
  { id: 4, name: 'Entertainment', description: 'Movies, TV shows, celebrities, pop culture, and entertainment news' },
  { id: 5, name: 'Gaming', description: 'Video games, esports, gaming news, reviews, and gaming communities' },
  { id: 6, name: 'Education', description: 'Learning, courses, tutorials, academic content, and educational resources' },
  { id: 7, name: 'Health & Fitness', description: 'Health tips, fitness, nutrition, wellness, and medical advice' },
  { id: 8, name: 'Lifestyle', description: 'Daily life, personal development, productivity, and lifestyle tips' },
  { id: 9, name: 'Travel', description: 'Travel guides, destinations, tips, photography, and travel experiences' },
  { id: 10, name: 'Food & Cooking', description: 'Recipes, cooking tips, restaurant reviews, and culinary content' },
  { id: 11, name: 'Fashion & Beauty', description: 'Fashion trends, beauty tips, style guides, and cosmetics' },
  { id: 12, name: 'Sports', description: 'Sports news, matches, athletes, teams, and sports analysis' },
  { id: 13, name: 'Crypto & Blockchain', description: 'Cryptocurrency, blockchain technology, DeFi, NFTs, and trading' },
  { id: 14, name: 'Marketing & Advertising', description: 'Marketing strategies, advertising, branding, and digital marketing' },
  { id: 15, name: 'Real Estate', description: 'Property listings, real estate news, investment, and market trends' },
  { id: 16, name: 'Automotive', description: 'Cars, motorcycles, automotive news, reviews, and vehicle maintenance' },
  { id: 17, name: 'Music', description: 'Music news, artists, albums, concerts, and music industry' },
  { id: 18, name: 'Art & Design', description: 'Visual arts, design, illustration, photography, and creative content' },
  { id: 19, name: 'Science', description: 'Scientific discoveries, research, space, nature, and educational science' },
  { id: 20, name: 'Politics', description: 'Political news, analysis, elections, and government affairs' },
  { id: 21, name: 'Comedy & Humor', description: 'Funny content, memes, jokes, and entertainment humor' },
  { id: 22, name: 'Pets & Animals', description: 'Pet care, animal content, pet training, and animal welfare' },
  { id: 23, name: 'Home & Garden', description: 'Home improvement, interior design, gardening, and DIY projects' },
  { id: 24, name: 'Parenting & Family', description: 'Parenting tips, family life, child development, and family activities' },
  { id: 25, name: 'Photography', description: 'Photography techniques, equipment, photo editing, and visual storytelling' },
  { id: 26, name: 'Books & Literature', description: 'Book reviews, reading recommendations, authors, and literary content' },
  { id: 27, name: 'Podcasts & Audio', description: 'Podcast recommendations, audio content, and audio production' },
  { id: 28, name: 'Motivation & Self-Improvement', description: 'Personal growth, motivation, success stories, and self-help' },
  { id: 29, name: 'Local & Regional', description: 'Local news, regional content, community updates, and city-specific channels' },
  { id: 30, name: 'Hobbies & Interests', description: 'Various hobbies, interests, and niche communities' },
];
