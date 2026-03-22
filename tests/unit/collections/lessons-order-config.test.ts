/**
 * @fileType unit-test
 * @domain collections
 * @pattern schema-validation
 * @ai-summary Test that validates the Lessons collection has proper index and defaultSort configuration for the order field
 */
import { describe, expect, it } from 'vitest'
import { Lessons } from '@/server/payload/collections/Lessons'

describe('Lessons Collection Config', () => {
  describe('order field configuration', () => {
    it('should have index: true on the order field for efficient sorting', () => {
      // Find the order field in the collection
      const orderField = Lessons.fields.find((field) => 'name' in field && field.name === 'order')

      expect(orderField).toBeDefined()
      expect(orderField).toHaveProperty('type', 'number')
      expect(orderField).toHaveProperty('index', true)
    })

    it('should have defaultSort set to order in collection config', () => {
      // Verify the collection config has defaultSort set to 'order'
      expect(Lessons).toHaveProperty('defaultSort', 'order')
    })
  })
})
