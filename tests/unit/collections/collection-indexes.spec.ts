/**
 * Unit Tests for Collection Indexes
 *
 * Tests that index: true is set on the following fields:
 * - Status fields: Courses.status, Chapters.status, Lessons.status, Tenants.status
 * - Relationship fields: Courses.categories, Posts.categories, Posts.authors,
 *   Exercises.sourceDoc, ConfigAuditLogs.tenant, GuestSessions.claimedByUser
 *
 * These tests should FAIL initially (TDD Red Phase) because index: true
 * is not yet added to these fields.
 */
import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'
import { Tenants } from '@/server/payload/collections/Tenants'
import { Posts } from '@/server/payload/collections/Posts/index'
import { Exercises } from '@/server/payload/collections/Exercises/index'
import { ConfigAuditLogs } from '@/server/payload/collections/ConfigAuditLogs'
import { GuestSessions } from '@/server/payload/collections/GuestSessions'

/**
 * Helper to recursively find fields in nested structures (tabs, groups, rows, collapsibles, arrays)
 */
function findFieldByName(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field
    // Check tabs
    if (field.type === 'tabs' && 'tabs' in field) {
      for (const tab of field.tabs) {
        const found = findFieldByName(tab.fields as Field[], name)
        if (found) return found
      }
    }
    // Check group/collapsible/row sub-fields
    if ('fields' in field && Array.isArray(field.fields)) {
      const found = findFieldByName(field.fields as Field[], name)
      if (found) return found
    }
    // Check array items
    if (field.type === 'array' && field.fields) {
      const found = findFieldByName(field.fields as Field[], name)
      if (found) return found
    }
  }
  return undefined
}

describe('Collection Indexes', () => {
  describe('Status Fields', () => {
    describe('Courses.status', () => {
      it('should have index: true', () => {
        const field = Courses.fields?.find((f) => 'name' in f && f.name === 'status') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Chapters.status', () => {
      it('should have index: true', () => {
        const field = Chapters.fields?.find((f) => 'name' in f && f.name === 'status') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Lessons.status', () => {
      it('should have index: true', () => {
        const field = Lessons.fields?.find((f) => 'name' in f && f.name === 'status') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Tenants.status', () => {
      it('should have index: true', () => {
        const field = Tenants.fields?.find((f) => 'name' in f && f.name === 'status') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })
  })

  describe('Relationship Fields', () => {
    describe('Courses.categories', () => {
      it('should have index: true', () => {
        const field = Courses.fields?.find((f) => 'name' in f && f.name === 'categories') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Posts.categories', () => {
      it('should have index: true', () => {
        const field = findFieldByName(Posts.fields as Field[], 'categories') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Posts.authors', () => {
      it('should have index: true', () => {
        const field = findFieldByName(Posts.fields as Field[], 'authors') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('Exercises.sourceDoc', () => {
      it('should have index: true', () => {
        const field = findFieldByName(Exercises.fields as Field[], 'sourceDoc') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('ConfigAuditLogs.tenant', () => {
      it('should have index: true', () => {
        const field = ConfigAuditLogs.fields?.find((f) => 'name' in f && f.name === 'tenant') as
          | { name: string; index?: boolean }
          | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })

    describe('GuestSessions.claimedByUser', () => {
      it('should have index: true', () => {
        const field = GuestSessions.fields?.find(
          (f) => 'name' in f && f.name === 'claimedByUser',
        ) as { name: string; index?: boolean } | undefined
        expect(field).toBeDefined()
        expect(field?.index).toBe(true)
      })
    })
  })
})
