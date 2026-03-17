/**
 * @fileType unit-test
 * @domain fields
 * @pattern content-status-fields
 * @ai-summary Tests for contentStatusFields reusable field definition
 */
import { describe, expect, it } from 'vitest'

// Import the contentStatusFields
import { contentStatusFields } from '@/server/payload/fields/contentStatus'

// Helper type for basic field properties
type BasicField = {
  name?: string
  type?: string
  defaultValue?: unknown
  required?: boolean
  index?: boolean
  options?: Array<{ label: string; value: string }>
}

describe('contentStatusFields', () => {
  describe('field structure', () => {
    it('exports an array of 3 Field objects', () => {
      expect(contentStatusFields).toBeDefined()
      expect(Array.isArray(contentStatusFields)).toBe(true)
      expect(contentStatusFields).toHaveLength(3)
    })

    it('contains contentStatus, contentStatusVisible, and contentStatusExpiresAt fields', () => {
      const fields = contentStatusFields as BasicField[]
      const fieldNames = fields.map((f) => f.name)
      expect(fieldNames).toContain('contentStatus')
      expect(fieldNames).toContain('contentStatusVisible')
      expect(fieldNames).toContain('contentStatusExpiresAt')
    })
  })

  describe('contentStatus field', () => {
    it('is a select field type', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatus')
      expect(field?.type).toBe('select')
    })

    it('has correct options: none, soon, justAdded', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatus')
      expect(field?.options).toBeDefined()
      const options = field?.options as Array<{ label: string; value: string }>
      expect(options).toHaveLength(3)
      expect(options.map((o) => o.value)).toEqual(['none', 'soon', 'justAdded'])
    })

    it('defaults to "none"', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatus')
      expect(field?.defaultValue).toBe('none')
    })

    it('is indexed', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatus')
      expect(field?.index).toBe(true)
    })
  })

  describe('contentStatusVisible field', () => {
    it('is a checkbox field type', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatusVisible')
      expect(field?.type).toBe('checkbox')
    })

    it('defaults to true', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatusVisible')
      expect(field?.defaultValue).toBe(true)
    })
  })

  describe('contentStatusExpiresAt field', () => {
    it('is a date field type', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatusExpiresAt')
      expect(field?.type).toBe('date')
    })

    it('is not required', () => {
      const fields = contentStatusFields as BasicField[]
      const field = fields.find((f) => f.name === 'contentStatusExpiresAt')
      expect(field?.required).toBeFalsy()
    })
  })
})
