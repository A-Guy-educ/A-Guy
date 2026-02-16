/**
 * Interactive Demo Configuration
 *
 * @fileType utility
 * @domain config
 * @pattern typed-config-accessor
 * @ai-summary Typed getter for interactive_demo domain config values with hardcoded fallbacks
 */
import { ConfigDomain } from '@/infra/config/config-constants'
import { getConfigDomain } from '@/infra/config/runtime/config-values'

export interface InteractiveDemoConfig {
  enabled: boolean
}

const DEFAULTS: InteractiveDemoConfig = {
  enabled: false,
}

export async function getInteractiveDemoConfig(tenantId?: string): Promise<InteractiveDemoConfig> {
  try {
    const config = await getConfigDomain<InteractiveDemoConfig>(ConfigDomain.InteractiveDemo, {
      throwIfNotFound: false,
      tenantId,
    })
    return { ...DEFAULTS, ...config }
  } catch {
    return DEFAULTS
  }
}
