/**
 * System Events - SITE_INIT Schema Tests
 *
 * Tests for Zod schema validation of SITE_INIT event.
 */

import { describe, expect, it } from 'vitest'

import { SYSTEM_EVENTS } from '@/infra/system-events/events'
import { eventSchemas, SiteInitSchema } from '@/infra/system-events/schemas'

describe('SiteInitSchema', () => {
  it('validates empty object payload', () => {
    const payload = {}
    const result = SiteInitSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects payload with unknown properties', () => {
    const payload = { unexpected_field: 'value' }
    const result = SiteInitSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('is registered in eventSchemas registry', () => {
    expect(eventSchemas[SYSTEM_EVENTS.SITE_INIT]).toBe(SiteInitSchema)
  })
})
