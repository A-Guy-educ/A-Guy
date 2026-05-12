import type { PayloadRequest } from 'payload'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'

// Mock the translation module so tests don't call OpenAI
vi.mock('@/server/payload/fields/translateForSlug', () => ({
  containsHebrew: (input: string) => /[\u0590-\u05FF]/.test(input),
  translateHebrewForSlug: vi.fn().mockResolvedValue('first lesson'),
}))

describe('formatSlug integration with collections', () => {
  describe('Courses beforeChange hook', () => {
    const beforeChangeHook = Courses.hooks?.beforeChange?.[0]

    it('should generate transliterated slug for Hebrew title', () => {
      expect(beforeChangeHook).toBeDefined()

      const mockData = { title: 'שלום עולם' }
      // @ts-expect-error - Hook has complex signature, we're testing simple case
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('shlvm-avlm')
    })

    it('should generate slug from English title', () => {
      const mockData = { title: 'Math Course' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('math-course')
    })

    it('should NOT overwrite existing slug on update', () => {
      const mockData = { title: 'New Title', slug: 'existing-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('existing-slug')
    })

    it('should NOT generate slug when title is missing', () => {
      const mockData = { slug: undefined }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBeUndefined()
    })
  })

  describe('Chapters beforeChange hook', () => {
    const beforeChangeHook = Chapters.hooks?.beforeChange?.[0]

    it('should generate transliterated slug for Hebrew title', () => {
      expect(beforeChangeHook).toBeDefined()

      const mockData = { title: 'פרק ראשון' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBeDefined()
      expect(result.slug.length).toBeGreaterThan(0)
      expect(result.slug).not.toMatch(/^item-/)
    })

    it('should generate slug from English title', () => {
      const mockData = { title: 'First Chapter' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('first-chapter')
    })

    it('should NOT overwrite existing slug on update', () => {
      const mockData = { title: 'New Title', slug: 'existing-chapter-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('existing-chapter-slug')
    })
  })

  describe('Lessons beforeChange hook', () => {
    const beforeChangeHook = Lessons.hooks?.beforeChange?.[0]

    const mockPayloadFind = vi.fn()
    const mockReq = {
      payload: { find: mockPayloadFind },
    } as unknown as PayloadRequest

    beforeEach(() => {
      mockPayloadFind.mockReset()
    })

    it('should translate Hebrew title to English for slug on create', async () => {
      expect(beforeChangeHook).toBeDefined()
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = { title: 'שיעור ראשון' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      // Mock returns 'first lesson' → slugified to 'first-lesson'
      expect(result.slug).toBe('first-lesson')
    })

    it('should generate slug from English title on create', async () => {
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = { title: 'First Lesson' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson')
    })

    it('should regenerate slug when title changes on update', async () => {
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = { title: 'New Lesson Title', slug: 'old-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'update',
        originalDoc: { id: 'my-id', title: 'Old Title', slug: 'old-slug' },
        req: mockReq,
      })

      expect(result.slug).toBe('new-lesson-title')
    })

    it('should keep slug when title is unchanged on update', async () => {
      const mockData = { title: 'Same Title', slug: 'existing-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'update',
        originalDoc: { id: 'my-id', title: 'Same Title', slug: 'existing-slug' },
        req: mockReq,
      })

      expect(result.slug).toBe('existing-slug')
      expect(mockPayloadFind).not.toHaveBeenCalled()
    })

    it('should normalize slug with spaces to URL-safe hyphenated form', async () => {
      mockPayloadFind.mockResolvedValue({ docs: [] })

      // Title "First Lesson" with a space-containing slug: the title doesn't
      // match the slug pattern (slugified title ≠ slug), so no regeneration.
      // Defense-in-depth catches the space and normalizes to URL-safe form.
      const mockData = { title: 'First Lesson', slug: 'first-lesson - Copy' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson-copy')
    })

    it('should add numeric suffix when slug already exists', async () => {
      mockPayloadFind
        .mockResolvedValueOnce({ docs: [{ id: 'other-id' }] })
        .mockResolvedValueOnce({ docs: [] })

      const mockData = { title: 'First Lesson' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson-1')
    })

    it('should ensure uniqueness when title changes to existing slug', async () => {
      mockPayloadFind
        .mockResolvedValueOnce({ docs: [{ id: 'other-id' }] })
        .mockResolvedValueOnce({ docs: [] })

      const mockData = { title: 'Taken Title', slug: 'old-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'update',
        originalDoc: { id: 'my-id', title: 'Old Title', slug: 'old-slug' },
        req: mockReq,
      })

      expect(result.slug).toBe('taken-title-1')
    })
  })
})
