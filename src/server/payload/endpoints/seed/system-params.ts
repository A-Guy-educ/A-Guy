/**
 * System Parameters Seed
 *
 * @fileType seed-function
 * @domain config.seed
 * @pattern data-seeding
 * @ai-summary Seeds default system parameters into the database
 *
 * System parameters are application constants that can be managed at runtime.
 * These values match src/server/config/constants.ts defaults.
 */

import { ConfigKind } from '@/infra/config/config-constants'
import type { Payload } from 'payload'

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
export async function seedSystemParams(payload: Payload, tenantId: string): Promise<void> {
  payload.logger.info('— Seeding system params...')

  for (const param of SYSTEM_PARAMS) {
    // Check if param already exists
    const existing = await payload.find({
      collection: 'config_entries',
      where: {
        key: { equals: param.key },
        tenant: { equals: tenantId },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      payload.logger.info(`  Skipped (exists): ${param.key}`)
      continue
    }

    // Create the system param
    await payload.create({
      collection: 'config_entries',
      data: {
        key: param.key,
        value: param.value,
        kind: ConfigKind.SystemParam,
        tenant: tenantId,
        enabled: true,
      },
      overrideAccess: true,
    })

    payload.logger.info(`  Created: ${param.key} = ${param.value}`)
  }
}
