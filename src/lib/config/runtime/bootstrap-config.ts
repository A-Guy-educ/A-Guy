/**
 * Bootstrap Configuration
 *
 * @fileType implementation
 * @domain config.bootstrap
 * @ai-summary Bootstrap config values from environment (non-secret, pre-tenant)
 *
 * Bootstrap values are:
 * - Not secrets (just configuration identifiers)
 * - Needed before tenant system is initialized
 * - Stored in process.env
 * - Cannot use getVariable/getSecret because they require tenantId
 *
 * Usage:
 * ```typescript
 * import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
 *
 * const tenantSlug = getConfigValue('DEFAULT_TENANT_SLUG')
 * ```
 */

/**
 * Get a bootstrap configuration value from environment
 *
 * @param key - Environment variable key (e.g., 'DEFAULT_TENANT_SLUG')
 * @param options - Options for default value and error handling
 * @returns The configuration value
 *
 * @throws Error if key not found and no default provided
 *
 * @example
 * // Required value
 * const tenantSlug = getConfigValue('DEFAULT_TENANT_SLUG')
 *
 * @example
 * // With default value
 * const timeout = getConfigValue('REQUEST_TIMEOUT', { defaultValue: '5000' })
 *
 * @example
 * // Optional value (returns empty string if not found)
 * const value = getConfigValue('OPTIONAL_KEY', { throwIfNotFound: false })
 */
export function getConfigValue(
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  const value = process.env[key]
  const { defaultValue, throwIfNotFound = true } = options ?? {}

  if (value !== undefined && value !== '') {
    return value
  }

  if (defaultValue !== undefined) {
    return defaultValue
  }

  if (!throwIfNotFound) {
    return ''
  }

  throw new Error(
    `Bootstrap configuration value "${key}" is required but not set. ` +
      `Please add ${key} to your environment variables.`,
  )
}

/**
 * Check if a bootstrap configuration value is set
 */
export function hasConfigValue(key: string): boolean {
  const value = process.env[key]
  return value !== undefined && value !== ''
}
