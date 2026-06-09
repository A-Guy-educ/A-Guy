/**
 * Unit tests for LessonBlocksField autosave config (#2552)
 *
 * Tests that the Lessons collection has versions.drafts.autosave configured
 * so that setModified(true) actually triggers an autosave PATCH request.
 *
 * @fileType unit-test
 * @domain collections
 * @ai-summary Test that validates Lessons collection has autosave configured
 */
import { describe, expect, it } from 'vitest'
import { Lessons } from '@/server/payload/collections/Lessons'

describe('Lessons Collection Autosave Config (#2552)', () => {
  describe('versions.drafts.autosave', () => {
    it('should have versions.drafts.autosave configured', () => {
      expect(Lessons).toHaveProperty('versions')
      // versions can be boolean | IncomingCollectionVersions — guard against boolean false
      const versions = Lessons.versions
      expect(typeof versions).toBe('object')
      expect(versions).not.toBeNull()
      expect((versions as { drafts?: unknown }).drafts).toBeDefined()
      expect((versions as { drafts: { autosave?: unknown } }).drafts.autosave).toBeDefined()
    })

    it('should have autosave.interval set to a reasonable value (Posts uses 100ms)', () => {
      const versions = Lessons.versions as { drafts: { autosave: { interval?: number } } }
      expect(versions.drafts.autosave).toHaveProperty('interval')
      expect(typeof versions.drafts.autosave.interval).toBe('number')
      expect(versions.drafts.autosave.interval).toBeGreaterThan(0)
    })

    it('should have schedulePublish enabled for draft workflow', () => {
      const versions = Lessons.versions as { drafts: { schedulePublish?: boolean } }
      expect(versions.drafts.schedulePublish).toBe(true)
    })

    it('should have maxPerDoc set for version history limit', () => {
      const versions = Lessons.versions as { maxPerDoc?: number }
      expect(versions).toHaveProperty('maxPerDoc')
      expect(typeof versions.maxPerDoc).toBe('number')
    })
  })
})
