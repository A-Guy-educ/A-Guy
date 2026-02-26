/**
 * Guest Session Type Safety Tests
 *
 * These tests verify that the guest-session.ts file uses the generated
 * GuestSession type from payload-types.ts instead of a custom interface.
 *
 * @fileType test
 * @domain auth
 * @pattern type-safety
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// Path to the source file being tested
// Go up from tests/unit/server/services/ to project root
const PROJECT_ROOT = path.resolve(__dirname, '../../../../')
const SOURCE_FILE_PATH = path.join(PROJECT_ROOT, 'src/server/services/guest-session.ts')

describe('GuestSession Type Safety', () => {
  let sourceContent: string

  beforeAll(() => {
    // Read the source file content once for all tests
    sourceContent = fs.readFileSync(SOURCE_FILE_PATH, 'utf-8')
  })

  describe('Bug Reproduction: Custom GuestSessionDoc interface should NOT exist', () => {
    it('should not define a custom GuestSessionDoc interface', () => {
      // BEFORE FIX: This test FAILS because the interface exists on line 23
      // AFTER FIX: This test PASSES because the interface is removed
      const hasCustomInterface = sourceContent.includes('interface GuestSessionDoc')

      expect(hasCustomInterface).toBe(false)
    })
  })

  describe('Bug Reproduction: Unsafe type casts should NOT exist', () => {
    it('should not contain unsafe "as unknown as" type casts', () => {
      // BEFORE FIX: This test FAILS because line 168 has `as unknown as GuestSessionDoc`
      // AFTER FIX: This test PASSES because the cast is removed
      const hasUnsafeCast = sourceContent.includes('as unknown as')

      expect(hasUnsafeCast).toBe(false)
    })

    it('should not contain "as GuestSessionDoc" casts', () => {
      // BEFORE FIX: This test FAILS because there are multiple occurrences
      // AFTER FIX: This test PASSES because casts are removed
      const hasGuestSessionDocCast = sourceContent.includes('as GuestSessionDoc')

      expect(hasGuestSessionDocCast).toBe(false)
    })
  })

  describe('Bug Fix Verification: Should use generated type', () => {
    it('should import GuestSession from payload-types', () => {
      // BEFORE FIX: This test FAILS because no such import exists
      // AFTER FIX: This test PASSES because import is added
      const hasGuestSessionImport = sourceContent.includes(
        "import type { GuestSession } from '@/payload-types'",
      )

      expect(hasGuestSessionImport).toBe(true)
    })
  })

  describe('Preserved Functionality: Safe type casts should remain', () => {
    it('should keep "guest-sessions" as const casts', () => {
      // BEFORE FIX: This test PASSES (these are type-safe and should remain)
      // AFTER FIX: This test PASSES (these should be preserved)
      const hasGuestSessionsConst = sourceContent.includes("'guest-sessions' as const")

      expect(hasGuestSessionsConst).toBe(true)
    })

    it('should keep "guest-sessions" as const in multiple locations', () => {
      // Count occurrences of 'guest-sessions' as const - should be present in multiple places
      const matches = sourceContent.match(/'guest-sessions' as const/g)

      expect(matches).not.toBeNull()
      expect(matches?.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('File Structure Integrity', () => {
    it('should export GUEST_SESSION_COOKIE_NAME constant', () => {
      const hasCookieNameExport = sourceContent.includes('export const GUEST_SESSION_COOKIE_NAME')

      expect(hasCookieNameExport).toBe(true)
    })

    it('should export session management functions', () => {
      const expectedExports = [
        'export function generateSessionToken',
        'export function hashToken',
        'export function verifyTokenHash',
        'export async function createGuestSession',
        'export async function getGuestSessionByToken',
        'export async function updateGuestSessionActivity',
        'export async function revokeGuestSession',
      ]

      for (const exportStr of expectedExports) {
        expect(sourceContent.includes(exportStr)).toBe(true)
      }
    })
  })
})
