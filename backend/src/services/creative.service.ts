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
    return this.reject(dealId, notes);
  }
}
