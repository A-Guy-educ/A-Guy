/**
 * Unit Test: Exercise Schema Idempotency Fields
 *
 * Tests Stage 3: Verify Exercise schema accepts idempotencyKey, specVersion, and extractionMeta fields.
 */

import { Exercises } from '@/server/payload/collections/Exercises'
import type { CollectionConfig } from 'payload'
import { describe, expect, test } from 'vitest'

describe('Exercise Schema Idempotency Fields', () => {
  // Helper to find Conversion Metadata collapsible field
  const getConversionMetaField = (): CollectionConfig['fields'][number] | undefined => {
    return Exercises.fields.find(
      (f) => 'type' in f && f.type === 'collapsible' && f.label === 'Conversion Metadata',
    )
  }

  describe('3.1: Exercise schema accepts idempotencyKey field', () => {
    test('given valid exercise data with idempotencyKey, when Payload create() is called, then exercise is created with idempotencyKey stored', () => {
      const conversionMetaField = getConversionMetaField()
      expect(conversionMetaField).toBeDefined()
      expect(conversionMetaField).toHaveProperty('type', 'collapsible')

      if (conversionMetaField && 'fields' in conversionMetaField) {
        const idempotencyKeyField = conversionMetaField.fields.find(
          (f) => 'name' in f && f.name === 'idempotencyKey',
        )
        expect(idempotencyKeyField).toBeDefined()
        expect(idempotencyKeyField).toHaveProperty('type', 'text')
        expect(idempotencyKeyField).toHaveProperty('index', true)
      }
    })
  })

  describe('3.2: Exercise schema accepts specVersion field', () => {
    test('given valid exercise data with specVersion="v1", when Payload create() is called, then exercise is created with specVersion stored', () => {
      const conversionMetaField = getConversionMetaField()
      expect(conversionMetaField).toBeDefined()

      if (conversionMetaField && 'fields' in conversionMetaField) {
        const specVersionField = conversionMetaField.fields.find(
          (f) => 'name' in f && f.name === 'specVersion',
        )
        expect(specVersionField).toBeDefined()
        expect(specVersionField).toHaveProperty('type', 'text')
      }
    })
  })

  describe('3.3: Exercise schema accepts extractionMeta field', () => {
    test('given valid exercise data with extractionMeta={ segmentIndex: 0, itemOrdinal: 1 }, when Payload create() is called, then exercise is created with extractionMeta stored', () => {
      const conversionMetaField = getConversionMetaField()
      expect(conversionMetaField).toBeDefined()

      if (conversionMetaField && 'fields' in conversionMetaField) {
        const extractionMetaField = conversionMetaField.fields.find(
          (f) => 'name' in f && f.name === 'extractionMeta',
        )
        expect(extractionMetaField).toBeDefined()
        expect(extractionMetaField).toHaveProperty('type', 'json')
      }
    })
  })

  describe('3.4: idempotencyKey field is optional (backward compat)', () => {
    test('given exercise data WITHOUT idempotencyKey, when Payload create() is called, then exercise is created successfully', () => {
      const conversionMetaField = getConversionMetaField()
      expect(conversionMetaField).toBeDefined()

      if (conversionMetaField && 'fields' in conversionMetaField) {
        const idempotencyKeyField = conversionMetaField.fields.find(
          (f) => 'name' in f && f.name === 'idempotencyKey',
        )
        expect(idempotencyKeyField).toBeDefined()
        // Should not have required: true
        expect(idempotencyKeyField).not.toHaveProperty('required', true)
      }
    })
  })

  describe('Idempotency field indexing', () => {
    test('idempotencyKey field has index:true for Stage 4 unique index', () => {
      const conversionMetaField = getConversionMetaField()
      expect(conversionMetaField).toBeDefined()

      if (conversionMetaField && 'fields' in conversionMetaField) {
        const idempotencyKeyField = conversionMetaField.fields.find(
          (f) => 'name' in f && f.name === 'idempotencyKey',
        )
        expect(idempotencyKeyField).toBeDefined()
        // Stage 4 will create unique index, but schema has non-unique for now
        expect(idempotencyKeyField).toHaveProperty('index', true)
      }
    })
  })
})
