export interface Campaign {
  id: number;
  advertiser_id: number;
  title: string;
  description?: string;
  budget_ton?: number;
  target_subscribers_min?: number;
  target_subscribers_max?: number;
  target_views_min?: number;
  target_languages?: string[];
  preferred_formats?: string[];
  status: string;
  created_at: Date;
  updated_at: Date;
}
