import { describe, it, expect } from 'vitest'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'

describe('formatSlug integration with collections', () => {
  describe('Courses beforeChange hook', () => {
    const beforeChangeHook = Courses.hooks?.beforeChange?.[0]

    it('should generate non-empty slug for Hebrew title (via fallback)', () => {
      expect(beforeChangeHook).toBeDefined()

      // Simulate the hook call
      const mockData = { title: 'שלום עולם' }
      // @ts-expect-error - Hook has complex signature, we're testing simple case
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBeDefined()
      expect(result.slug.length).toBeGreaterThan(0)
      // slugify with strict:true strips Hebrew → empty → fallback used
      expect(result.slug).toMatch(/^item-[a-z0-9]+$/)
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

    it('should generate non-empty slug for Hebrew title (via fallback)', () => {
      expect(beforeChangeHook).toBeDefined()

      const mockData = { title: 'פרק ראשון' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBeDefined()
      expect(result.slug.length).toBeGreaterThan(0)
      // slugify with strict:true strips Hebrew → empty → fallback used
      expect(result.slug).toMatch(/^item-[a-z0-9]+$/)
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

    it('should generate non-empty slug with timestamp suffix for Hebrew title', () => {
      expect(beforeChangeHook).toBeDefined()

      const mockData = { title: 'שיעור ראשון', createdAt: '2024-01-01T12:00:00.000Z' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBeDefined()
      expect(result.slug.length).toBeGreaterThan(0)
      // slugify strips Hebrew → fallback with timestamp suffix
      expect(result.slug).toMatch(/^item-[a-z0-9]+-[0-9]{6}$/)
    })

    it('should generate slug from English title with timestamp suffix', () => {
      // When createdAt is not a string or doesn't match the expected format,
      // the hook uses Date.now() for the timestamp
      const mockData = { title: 'First Lesson', createdAt: undefined }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      // Should contain the slugified title and a timestamp suffix
      expect(result.slug).toMatch(/^first-lesson-[0-9]{6}$/)
    })

    it('should NOT overwrite existing slug on update', () => {
      const mockData = { title: 'New Title', slug: 'existing-lesson-slug' }
      // @ts-expect-error - Hook has complex signature
      const result = beforeChangeHook({ data: mockData })

      expect(result.slug).toBe('existing-lesson-slug')
    })
  })
})
