/**
 * DVT Talent AI — Authentication & User Types
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export type UserRole = "admin" | "manager" | "recruiter" | "viewer" | "candidate";

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  is_superadmin?: boolean;
  mfa_enabled?: boolean;
  avatar_url?: string;
  last_login?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token?: string;
  token_type?: string;
  user_id?: string;
  tenant_id?: string | null;
  email?: string;
  full_name?: string;
  role: string;
  is_superadmin?: boolean;
  mfa_required?: boolean;
  challenge_token?: string;
  mfa_enabled?: boolean;
}
