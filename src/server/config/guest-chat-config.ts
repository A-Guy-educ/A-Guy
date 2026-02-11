/**
 * Guest Chat Configuration
 *
 * @fileType utility
 * @domain config
 * @pattern typed-config-accessor
 * @ai-summary Typed getter for guest_chat domain config values with hardcoded fallbacks
 */
import { ConfigDomain } from '@/infra/config/config-constants'
import { getConfigDomain } from '@/infra/config/runtime/config-values'

export interface GuestChatConfig {
  sliding_ttl_days: number
  hard_cap_days: number
  max_conversations: number
  max_messages: number
  rate_limit_window_ms: number
  rate_limit_max_requests: number
}

const DEFAULTS: GuestChatConfig = {
  sliding_ttl_days: 7,
  hard_cap_days: 30,
  max_conversations: 5,
  max_messages: 5,
  rate_limit_window_ms: 60_000,
  rate_limit_max_requests: 1,
}

export async function getGuestChatConfig(): Promise<GuestChatConfig> {
  try {
    const config = await getConfigDomain<GuestChatConfig>(ConfigDomain.GuestChat, {
      throwIfNotFound: false,
    })
    return { ...DEFAULTS, ...config }
  } catch {
    return DEFAULTS
  }
}
