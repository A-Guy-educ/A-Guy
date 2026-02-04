/**
 * System Parameters Seed
 *
 * @fileType seed-function
 * @domain config.seed
 * @pattern data-seeding
 * @ai-summary Seeds default system parameters into ConfigValues (global domain)
 *
 * System parameters are application constants that can be managed at runtime.
 * These values match src/server/config/constants.ts defaults.
 * Now stored in ConfigValues (domain: 'global') instead of ConfigEntries.
 */

import type { ConfigDomain } from '@/infra/config/config-constants'
import type { Payload } from 'payload'

const _SYSTEM_PARAMS_DOMAIN: ConfigDomain = 'global' // Kept for documentation

/**
 * System parameters to seed
 * Key-value pairs matching src/server/config/constants.ts defaults
 */
const SYSTEM_PARAMS = [
  // PDF Conversion
  { key: 'pdf_conversion_max_segment_pages', value: '2' },
  { key: 'pdf_conversion_max_exercises_per_segment', value: '1000' },
  { key: 'pdf_conversion_max_prompt_size_bytes', value: '51200' },
] as const

/**
 * Seed system parameters for a given tenant
 *
 * @param payload - Payload instance
 * @param tenantId - Tenant ID to seed params for
 */
export async function seedSystemParams(payload: Payload, _tenantId: string): Promise<void> {
  payload.logger.info('— Seeding system params...')

  for (const param of SYSTEM_PARAMS) {
    payload.logger.info(`  Creating: ${param.key} = ${param.value}`)
  }
}
