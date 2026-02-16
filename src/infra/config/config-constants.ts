/**
 * Config Constants
 *
 * @fileType utility
 * @domain config
 * @pattern constants
 * @ai-summary Configuration constants for the config manager
 */

/**
 * Kind enum for config entry types (ConfigEntries collection)
 */
export const ConfigKind = {
  Variable: 'variable',
  Secret: 'secret',
  SystemParam: 'system_param',
} as const

export type ConfigKind = (typeof ConfigKind)[keyof typeof ConfigKind]

/**
 * Domain enum for config values (ConfigValues collection)
 * Groups configuration by feature domain for organized management
 */
export const ConfigDomain = {
  Chat: 'chat',
  PdfConversion: 'pdf_conversion',
  Global: 'global',
  GuestChat: 'guest_chat',
  InteractiveDemo: 'interactive_demo',
} as const

export type ConfigDomain = (typeof ConfigDomain)[keyof typeof ConfigDomain]

/**
 * All domains as array for select options
 */
export const CONFIG_DOMAINS = Object.values(ConfigDomain)

/**
 * Action enum for audit log entries
 */
export const ConfigAction = {
  Created: 'created',
  Updated: 'updated',
  Enabled: 'enabled',
  Disabled: 'disabled',
} as const

export type ConfigAction = (typeof ConfigAction)[keyof typeof ConfigAction]

/**
 * Secret-like key patterns to block for variables
 * Prevents accidental storage of secrets as variables
 */
export const SECRET_KEY_PATTERNS = [
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /password/i,
  /private/i,
  /credential/i,
  /key$/i,
]

/**
 * Validates that a key is in snake_case or SCREAMING_SNAKE_CASE
 * Supports both lowercase (my_config_key) and uppercase (MY_CONFIG_KEY) formats
 */
export function isSnakeCase(key: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*(_[a-zA-Z0-9]+)*$/.test(key)
}

/**
 * Check if a key looks like it should be a secret
 */
export function looksLikeSecret(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))
}
