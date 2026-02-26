/**
 * Unit tests for guest-session.ts type safety
 *
 * These tests verify:
 * 1. No instances of 'guest-sessions' as const (should use plain string)
 * 2. GuestSessionDoc is a type alias to generated GuestSession type
 * 3. No type casts like 'as unknown as GuestSessionDoc' or 'as GuestSessionDoc'
 */
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('guest-session.ts type safety', () => {
  const sourcePath = path.join(process.cwd(), 'src/server/services/guest-session.ts')
  let sourceCode: string

  beforeAll(() => {
    sourceCode = fs.readFileSync(sourcePath, 'utf-8')
  })

  describe('No "as const" on collection slug', () => {
    it('should not have "as const" after "guest-sessions" string', () => {
      // The fix: remove 'as const' from collection slugs
      // Before fix: 'guest-sessions' as const (7 instances)
      // After fix: 'guest-sessions' (0 instances)
      const asConstPattern = /'guest-sessions'\s+as\s+const/g
      const matches = sourceCode.match(asConstPattern)

      expect(matches).toBeNull()
    })

    it('should use plain string "guest-sessions" for collection parameter', () => {
      // Verify plain string is still used (not removed)
      const plainStringPattern = /collection:\s*'guest-sessions'/g
      const matches = sourceCode.match(plainStringPattern)

      // There should be at least 7 instances of plain 'guest-sessions' string
      expect(matches).toHaveLength(7)
    })
  })

  describe('GuestSessionDoc type alias', () => {
    it('should export GuestSessionDoc', () => {
      // The fix: GuestSessionDoc should be exported
      expect(sourceCode).toContain('export type GuestSessionDoc')
    })

    it('should be a type alias to GuestSession from payload-types', () => {
      // After fix, GuestSessionDoc should reference the generated GuestSession type
      // import type { GuestSession } from '@/payload-types'
      // export type GuestSessionDoc = GuestSession
      const hasPayloadTypesImport = sourceCode.includes(
        "import type { GuestSession } from '@/payload-types'",
      )

      expect(hasPayloadTypesImport).toBe(true)
    })

    it('should not define GuestSessionDoc as a separate interface', () => {
      // Before fix: export interface GuestSessionDoc { ... }
      // After fix: export type GuestSessionDoc = GuestSession
      const definesSeparateInterface = sourceCode.match(/export\s+interface\s+GuestSessionDoc\s*\{/)

      expect(definesSeparateInterface).toBeNull()
    })

    it('should be a type alias (not interface)', () => {
      // Verify it's a type alias
      const isTypeAlias = sourceCode.includes('export type GuestSessionDoc = GuestSession')

      expect(isTypeAlias).toBe(true)
    })
  })

  describe('No type casts to GuestSessionDoc', () => {
    it('should not have "as unknown as GuestSessionDoc" casts', () => {
      // Before fix: session as unknown as GuestSessionDoc
      // After fix: should not have this pattern
      const unknownCastPattern = /as\s+unknown\s+as\s+GuestSessionDoc/g
      const matches = sourceCode.match(unknownCastPattern)

      expect(matches).toBeNull()
    })

    it('should not have "as GuestSessionDoc" casts', () => {
      // Before fix: session as GuestSessionDoc, return updated as GuestSessionDoc
      // After fix: should not have these casts
      const directCastPattern = /\s+as\s+GuestSessionDoc/g
      const matches = sourceCode.match(directCastPattern)

      expect(matches).toBeNull()
    })

    it('should not have type assertions on payload operations', () => {
      // Check for any type assertion to GuestSessionDoc
      // These patterns indicate type mismatch issues that should be fixed
      const typeAssertionPatterns = [/as\s+unknown\s+as\s+GuestSessionDoc/, /as\s+GuestSessionDoc/]

      for (const pattern of typeAssertionPatterns) {
        const matches = sourceCode.match(pattern)
        expect(matches).toBeNull()
      }
    })
  })

  describe('Generated type compatibility', () => {
    it('should import GuestSession from payload-types', () => {
      // Verify the import exists
      const importPattern =
        /import\s+type\s*\{[^}]*GuestSession[^}]*\}\s+from\s+['"]@\/payload-types['"]/
      const hasImport = importPattern.test(sourceCode)

      expect(hasImport).toBe(true)
    })

    it('should use GuestSessionDoc in function return types', () => {
      // The service functions should return GuestSessionDoc
      // After fix: the type alias makes this work without casts
      expect(sourceCode).toContain('Promise<{ session: GuestSessionDoc; token: string }>')
      expect(sourceCode).toContain('Promise<GuestSessionDoc | null>')
    })
  })
})
