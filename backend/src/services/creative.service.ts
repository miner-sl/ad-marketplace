import { CreativeRepository } from '../repositories/creative.repository';
import { Creative } from '../models/creative.types';

export class CreativeService {
  static async create(data: {
    deal_id: number;
    submitted_by: number;
    content_type: string;
    content_data: Record<string, any>;
  }): Promise<Creative> {
    return await CreativeRepository.create(data);
  }

  /**
   * Create a creative within an existing transaction
   */
  static async createWithClient(client: any, data: {
    deal_id: number;
    submitted_by: number;
    content_type: string;
    content_data: Record<string, any>;
  }): Promise<Creative> {
    return await CreativeRepository.createWithClient(client, data);
  }

  static async findByDeal(dealId: number): Promise<Creative | null> {
    return await CreativeRepository.findByDeal(dealId);
  }

  static async submit(dealId: number): Promise<Creative> {
    return await CreativeRepository.submit(dealId);
  }

  static async approve(dealId: number): Promise<Creative> {
    return await CreativeRepository.approve(dealId);
  }

  static async reject(dealId: number, notes: string): Promise<Creative> {
    return await CreativeRepository.reject(dealId, notes);
  }

  static async requestRevision(dealId: number, notes: string): Promise<Creative> {
    const creative = await this.findByDeal(dealId);
    if (!creative) {
      throw new Error(`Cannot request revision: Creative for Deal #${dealId} not found. Please submit a creative first.`);
    }
    return await CreativeRepository.reject(dealId, notes);
  }

  /**
   * Request revision within an existing transaction
   */
  static async requestRevisionWithClient(client: any, dealId: number, notes: string): Promise<Creative> {
    return await CreativeRepository.requestRevisionWithClient(client, dealId, notes);
  }
}
