import { withTx } from '../utils/transaction';
import { CampaignRepository } from '../repositories/campaign.repository';
import { UserModel } from '../repositories/user.repository';
import { Campaign } from '../models/campaign.types';

/**
 * DTO for creating a campaign
 */
export interface CreateCampaignDto {
  telegram_id: number;
  title: string;
  description?: string;
  budget_ton?: number;
  target_subscribers_min?: number;
  target_subscribers_max?: number;
  target_views_min?: number;
  target_languages?: string[];
  preferred_formats?: string[];
  username?: string;
  first_name?: string;
  last_name?: string;
}

export class CampaignsService {
  /**
   * Create a new campaign with user creation/update and role assignment
   * All database operations are wrapped in a single transaction
   */
  static async createCampaign(dto: CreateCampaignDto): Promise<Campaign> {
    return await withTx(async (client) => {
      const user = await UserModel.findOrCreateWithClient(client, {
        telegram_id: dto.telegram_id,
        username: dto.username,
        first_name: dto.first_name,
        last_name: dto.last_name,
      });

      await UserModel.updateRoleWithClient(client, dto.telegram_id, 'advertiser', true);

      const campaign = await CampaignRepository.createWithClient(client, {
        advertiser_id: user.id,
        title: dto.title,
        description: dto.description,
        budget_ton: dto.budget_ton,
        target_subscribers_min: dto.target_subscribers_min,
        target_subscribers_max: dto.target_subscribers_max,
        target_views_min: dto.target_views_min,
        target_languages: dto.target_languages,
        preferred_formats: dto.preferred_formats,
      });

      return campaign;
    });
  }
}
