import { ChannelModel, Topic } from '../repositories/channel-model.repository';
import logger from '../utils/logger';

/**
 * Singleton service for managing predefined topics
 * Loads all topics from database at startup and caches them in memory
 */
class TopicsService {
  private topics: Topic[] = [];
  private topicsMap: Map<number, Topic> = new Map();
  private topicsByNameMap: Map<string, Topic> = new Map();
  private initialized: boolean = false;

  /**
   * Should be called at application startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('TopicsService already initialized');
      return;
    }

    try {
      logger.info('Loading topics from database...');
      this.topics = await ChannelModel.findAllTopics();

      this.topicsMap.clear();
      this.topicsByNameMap.clear();

      for (const topic of this.topics) {
        this.topicsMap.set(topic.id, topic);
        this.topicsByNameMap.set(topic.name.toLowerCase(), topic);
      }

      this.initialized = true;
      logger.info(`TopicsService initialized with ${this.topics.length} topics`);
    } catch (error: any) {
      logger.error('Failed to initialize TopicsService', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get all topics
   */
  getAllTopics(): Topic[] {
    if (!this.initialized) {
      logger.warn('TopicsService not initialized, returning empty array');
      return [];
    }
    return [...this.topics];
  }

  /**
   * Get topic by ID
   */
  getTopicById(id: number): Topic | null {
    if (!this.initialized) {
      logger.warn('TopicsService not initialized');
      return null;
    }
    return this.topicsMap.get(id) || null;
  }

  /**
   * Get topic by name (case-insensitive)
   */
  getTopicByName(name: string): Topic | null {
    if (!this.initialized) {
      logger.warn('TopicsService not initialized');
      return null;
    }
    return this.topicsByNameMap.get(name.toLowerCase()) || null;
  }

  /**
   * Check if topic exists by ID
   */
  topicExists(id: number): boolean {
    if (!this.initialized) {
      return false;
    }
    return this.topicsMap.has(id);
  }
}

export const topicsService = new TopicsService();
