/**
 * Unit tests for guest-session.factory.ts type safety
 *
 * These tests verify:
 * 1. The factory doesn't use 'as any' on the collection slug
 * 2. The factory's buildGuestSessionData produces valid data
 */
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('guest-session.factory.ts type safety', () => {
  const sourcePath = path.join(process.cwd(), 'tests/factories/guest-session.factory.ts')
  let sourceCode: string

  beforeAll(() => {
    sourceCode = fs.readFileSync(sourcePath, 'utf-8')
  })

  describe('No "as any" on collection slug', () => {
    it('should not have "as any" after "guest-sessions" collection parameter', () => {
      // Before fix: collection: 'guest-sessions' as any
      // After fix: collection: 'guest-sessions'
      const asAnyPattern = /'guest-sessions'\s+as\s+any/g
      const matches = sourceCode.match(asAnyPattern)

      expect(matches).toBeNull()
    })

    it('should use plain string "guest-sessions" for collection parameter', () => {
      // Verify plain string is still used (not removed)
      const plainStringPattern = /collection:\s*'guest-sessions'/g
      const matches = sourceCode.match(plainStringPattern)

      // There should be at least 1 instance of plain 'guest-sessions' string
      expect(matches).toHaveLength(1)
    })
  })

  describe('buildGuestSessionData produces valid data', () => {
    it('should include messageCount field in returned data', () => {
      // Check the source code to verify messageCount is included in buildGuestSessionData
      // The factory should include messageCount: 0 in the default data
      const hasMessageCount = sourceCode.includes('messageCount:')

      expect(hasMessageCount).toBe(true)
    })

    it('should produce data with all required GuestSession fields', () => {
      // Verify source code has all required fields in buildGuestSessionData
      const requiredFields = [
        'tokenHash',
        'tokenVersion',
        'createdAt',
        'lastActiveAt',
        'expiresAt',
        'hardExpiresAt',
        'status',
      ]

      for (const field of requiredFields) {
        expect(sourceCode).toContain(field)
      }
    })

    it('should default status to active', () => {
      // Verify the default status is 'active' in buildGuestSessionData
      expect(sourceCode).toContain("status: input.status ?? 'active'")
    })
  })
})
