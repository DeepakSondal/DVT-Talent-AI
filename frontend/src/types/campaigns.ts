/**
 * DVT Talent AI — Email Campaign & Sender Types
 */

export interface EmailCampaign {
  id: string;
  name: string;
  campaign_type?: string;
  target_type?: string;
  subject_template?: string;
  body_template?: string;
  is_active: boolean;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  created_at: string;
}

export interface EmailSent {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  replied_at?: string;
  created_at: string;
}

export interface OAuthConnectPayload {
  sender_name?: string;
  sender_email?: string;
  code?: string;
}

export interface EmailSenderOut {
  oauth_provider?: "google" | "microsoft" | string | null;
  connection_mode?: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_verified: boolean;
  configured: boolean;
  connected_at?: string | null;
}
