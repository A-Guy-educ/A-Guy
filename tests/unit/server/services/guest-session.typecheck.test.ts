/**
 * Type safety tests for guest-session service
 * Verifies that GuestSessionDoc is identical to the generated GuestSession type
 */
import { describe, expectTypeOf, it } from 'vitest'
import type { GuestSession } from '@/payload-types'
import type { GuestSessionDoc } from '@/server/services/guest-session'
import type {
  createGuestSession,
  getGuestSessionByToken,
  updateGuestSessionActivity,
  revokeGuestSession,
  checkAndIncrementGuestMessageCount,
} from '@/server/services/guest-session'

describe('guest-session type safety', () => {
  /**
   * This test verifies the custom GuestSessionDoc interface is the same
   * as the auto-generated GuestSession type from Payload.
   *
   * BEFORE FIX: GuestSessionDoc is a custom interface missing fields like
   * ipHash, userAgentHash, claimedAt, and has wrong types for claimedByUser
   * → This test FAILS
   *
   * AFTER FIX: GuestSessionDoc is an alias to GuestSession
   * → This test PASSES
   */
  it('GuestSessionDoc should be identical to GuestSession', () => {
    // This verifies the custom type is the generated type, not a separate interface
    expectTypeOf<GuestSessionDoc>().toEqualTypeOf<GuestSession>()
  })

  it('createGuestSession should return GuestSession type', () => {
    type CreateReturn = Awaited<ReturnType<typeof createGuestSession>>
    expectTypeOf<CreateReturn['session']>().toEqualTypeOf<GuestSession>()
  })

  it('getGuestSessionByToken should return GuestSession | null', () => {
    type GetByTokenReturn = Awaited<ReturnType<typeof getGuestSessionByToken>>
    expectTypeOf<GetByTokenReturn>().toEqualTypeOf<GuestSession | null>()
  })

  it('updateGuestSessionActivity should return GuestSession | null', () => {
    type UpdateActivityReturn = Awaited<ReturnType<typeof updateGuestSessionActivity>>
    expectTypeOf<UpdateActivityReturn>().toEqualTypeOf<GuestSession | null>()
  })

  it('revokeGuestSession should return GuestSession | null', () => {
    type RevokeReturn = Awaited<ReturnType<typeof revokeGuestSession>>
    expectTypeOf<RevokeReturn>().toEqualTypeOf<GuestSession | null>()
  })
})
