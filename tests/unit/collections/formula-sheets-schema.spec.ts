/**
 * Unit Tests for FormulaSheets Collection Schema
 *
 * Tests the FormulaSheets collection configuration:
 * - Collection exists with correct slug
 * - Required fields: title, contentType, status
 * - Content type options: blocks, richText, pdf
 * - Relationship fields on Courses and Lessons
 */
import { describe, expect, it } from 'vitest'
import { FormulaSheets } from '@/server/payload/collections/FormulaSheets'
import { Courses } from '@/server/payload/collections/Courses'
import { Lessons } from '@/server/payload/collections/Lessons'

type PayloadField = {
  name?: string
  type: string
  required?: boolean
  index?: boolean
  relationTo?: string
  blocks?: Array<{ slug: string }>
  options?: Array<{ value: string }> | string[]
  defaultValue?: unknown
}

function findField(fields: unknown[], name: string): PayloadField | undefined {
  // Flatten spread arrays (like ...contentStatusFields)
  const flat = fields.flat() as PayloadField[]
  return flat.find((f) => 'name' in f && f.name === name) as PayloadField | undefined
}

describe('FormulaSheets Collection Schema', () => {
  it('should have correct slug', () => {
    expect(FormulaSheets.slug).toBe('formula-sheets')
  })

  describe('title field', () => {
    it('should exist and be required text', () => {
      const field = findField(FormulaSheets.fields, 'title')
      expect(field).toBeDefined()
      expect(field?.type).toBe('text')
      expect(field?.required).toBe(true)
    })

    it('should be indexed', () => {
      const field = findField(FormulaSheets.fields, 'title')
      expect(field?.index).toBe(true)
    })
  })

  describe('contentType field', () => {
    it('should exist and be required select', () => {
      const field = findField(FormulaSheets.fields, 'contentType')
      expect(field).toBeDefined()
      expect(field?.type).toBe('select')
      expect(field?.required).toBe(true)
    })

    it('should have blocks, richText, and pdf options', () => {
      const field = findField(FormulaSheets.fields, 'contentType')
      const options = (field?.options as Array<{ value: string }>)?.map((o) => o.value)
      expect(options).toContain('blocks')
      expect(options).toContain('richText')
      expect(options).toContain('pdf')
    })

    it('should default to blocks', () => {
      const field = findField(FormulaSheets.fields, 'contentType')
      expect(field?.defaultValue).toBe('blocks')
    })
  })

  describe('status field', () => {
    it('should exist with draft and published options', () => {
      const field = findField(FormulaSheets.fields, 'status')
      expect(field).toBeDefined()
      expect(field?.type).toBe('select')
      expect(field?.required).toBe(true)
      const options = (field?.options as Array<{ value: string }>)?.map((o) => o.value)
      expect(options).toContain('draft')
      expect(options).toContain('published')
    })

    it('should default to draft', () => {
      const field = findField(FormulaSheets.fields, 'status')
      expect(field?.defaultValue).toBe('draft')
    })
  })

  describe('pdfFile field', () => {
    it('should be upload type relating to media', () => {
      const field = findField(FormulaSheets.fields, 'pdfFile')
      expect(field).toBeDefined()
      expect(field?.type).toBe('upload')
      expect(field?.relationTo).toBe('media')
    })
  })

  describe('bodyBlocks field', () => {
    it('should be blocks type with Content, HtmlBlock, MediaBlock, TableBlock', () => {
      const field = findField(FormulaSheets.fields, 'bodyBlocks')
      expect(field).toBeDefined()
      expect(field?.type).toBe('blocks')
      const blockSlugs = field?.blocks?.map((b) => b.slug)
      expect(blockSlugs).toContain('content')
      expect(blockSlugs).toContain('html')
      expect(blockSlugs).toContain('mediaBlock')
      expect(blockSlugs).toContain('tableBlock')
    })
  })
})

describe('Course formulaSheet relationship', () => {
  it('should have formulaSheet field relating to formula-sheets', () => {
    const field = findField(Courses.fields, 'formulaSheet')
    expect(field).toBeDefined()
    expect(field?.type).toBe('relationship')
    expect(field?.relationTo).toBe('formula-sheets')
  })

  it('should be optional', () => {
    const field = findField(Courses.fields, 'formulaSheet')
    expect(field?.required).toBeFalsy()
  })
})

describe('Lesson formulaSheet relationship', () => {
  it('should have formulaSheet field relating to formula-sheets', () => {
    const field = findField(Lessons.fields, 'formulaSheet')
    expect(field).toBeDefined()
    expect(field?.type).toBe('relationship')
    expect(field?.relationTo).toBe('formula-sheets')
  })

  it('should be optional', () => {
    const field = findField(Lessons.fields, 'formulaSheet')
    expect(field?.required).toBeFalsy()
  })
})
