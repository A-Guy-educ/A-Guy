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
    const merged = { ...DEFAULTS, ...config }

    // Normalize enabled to boolean (handles string "true"/"false" from JSON)
    // Config may come as string from JSON parsing, so we need to handle both cases
    const enabledValue = merged.enabled as unknown
    const normalizedEnabled = Boolean(
      enabledValue === true ||
      enabledValue === 'true' ||
      (typeof enabledValue === 'string' && enabledValue.toLowerCase() === 'true'),
    )

    // TEMPORARY DEBUG LOGGING (per requirement #2)
    console.log('[getInteractiveDemoConfig] Debug:', {
      tenantId,
      rawConfig: config,
      merged,
      enabledValue,
      'typeof enabledValue': typeof enabledValue,
      normalizedEnabled,
      'normalizedEnabled === true': normalizedEnabled === true,
    })

    return { ...merged, enabled: normalizedEnabled }
  } catch (error) {
    console.error('[getInteractiveDemoConfig] Error:', error)
    return DEFAULTS
  }
}
