export interface Creative {
  id: number;
  deal_id: number;
  submitted_by: number;
  content_type: string;
  content_data: Record<string, any>;
  status: string;
  revision_notes?: string;
  created_at: Date;
  updated_at: Date;
}
