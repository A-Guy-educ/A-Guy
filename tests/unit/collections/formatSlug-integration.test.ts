import type { PayloadRequest } from 'payload'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'

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
      // Should be transliterated, not a fallback
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

    it('should generate transliterated slug for Hebrew title', async () => {
      expect(beforeChangeHook).toBeDefined()
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = { title: 'שיעור ראשון' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('shyavr-rshvn')
    })

    it('should generate slug from English title', async () => {
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

    it('should keep existing slug on update when unchanged', async () => {
      const mockData = { title: 'New Title', slug: 'existing-lesson-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'update',
        originalDoc: { id: 'my-id', slug: 'existing-lesson-slug' },
        req: mockReq,
      })

      expect(result.slug).toBe('existing-lesson-slug')
      // No DB query needed since slug didn't change
      expect(mockPayloadFind).not.toHaveBeenCalled()
    })

    it('should strip -copy suffix and regenerate slug', async () => {
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = { title: 'First Lesson', slug: 'first-lesson-copy' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson')
    })

    it('should strip repeated -copy-copy suffixes and regenerate', async () => {
      mockPayloadFind.mockResolvedValue({ docs: [] })

      const mockData = {
        title: 'First Lesson',
        slug: 'first-lesson-copy-copy-copy',
      }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson')
    })

    it('should add numeric suffix when slug already exists', async () => {
      mockPayloadFind
        .mockResolvedValueOnce({ docs: [{ id: 'other-id' }] }) // first-lesson taken
        .mockResolvedValueOnce({ docs: [] }) // first-lesson-1 available

      const mockData = { title: 'First Lesson' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson-1')
    })

    it('should check uniqueness when slug changes on update', async () => {
      mockPayloadFind
        .mockResolvedValueOnce({ docs: [{ id: 'other-id' }] }) // new-slug taken
        .mockResolvedValueOnce({ docs: [] }) // new-slug-1 available

      const mockData = { title: 'First Lesson', slug: 'new-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'update',
        originalDoc: { id: 'my-id', slug: 'old-slug' },
        req: mockReq,
      })

      expect(result.slug).toBe('new-slug-1')
    })

    it('should deduplicate slug on create even without -copy suffix', async () => {
      mockPayloadFind
        .mockResolvedValueOnce({ docs: [{ id: 'existing-id' }] }) // first-lesson taken
        .mockResolvedValueOnce({ docs: [] }) // first-lesson-1 available

      const mockData = { title: 'Other Title', slug: 'first-lesson' }
      // @ts-expect-error - Hook has complex signature
      const result = await beforeChangeHook({
        data: mockData,
        operation: 'create',
        req: mockReq,
      })

      expect(result.slug).toBe('first-lesson-1')
    })
  })
})
