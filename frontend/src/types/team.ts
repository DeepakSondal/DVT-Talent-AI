/**
 * DVT Talent AI — Team & BYOK Configuration Types
 */

export interface TeamApiKeysConfig {
  openai_key: string;
  serper_key: string;
  anthropic_key: string;
}

export interface TeamApiKeysOut {
  openai_key_hint: string | null;
  serper_key_hint: string | null;
  anthropic_key_hint: string | null;
  configured: boolean;
}
