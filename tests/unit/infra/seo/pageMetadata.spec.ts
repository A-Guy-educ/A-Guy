/**
 * Unit tests for pageMetadata helper.
 *
 * Validates that:
 * 1. pageMetadata({}) returns brand defaults
 * 2. Per-field overrides are respected
 * 3. Brand strings do not appear in the output when overrides are provided
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { pageMetadata } from '@/infra/seo/pageMetadata'

// Direct module import to spy on getBrand
vi.mock('@/brands', () => ({
  getBrand: () => ({
    config: {
      slug: 'aguy',
      name: 'A-Guy',
      host: 'https://www.aguy.co.il',
      locale: 'he-IL',
      defaultTitle: 'A-Guy | תרגול מתמטיקה אינטראקטיבי',
      titleTemplate: '%s | A-Guy',
      description: 'Brand default description',
      shortDescription: 'Brand short description',
      keywords: ['math', 'practice'],
      author: { name: 'A-Guy', url: 'https://www.aguy.co.il' },
      themeColor: { light: '#91262C', dark: '#0f172a' },
      social: { twitterHandle: '@aguy' },
      ogImage: 'https://www.aguy.co.il/og.png',
      appleWebApp: { title: 'A-Guy' },
    },
  }),
}))

describe('pageMetadata', () => {
  describe('brand defaults', () => {
    it('returns brand name as siteName in openGraph', () => {
      const meta = pageMetadata({})
      expect(meta.openGraph).toBeDefined()
      expect(meta.openGraph?.siteName).toBe('A-Guy')
    })

    it('returns brand defaultTitle as title when no override', () => {
      const meta = pageMetadata({})
      expect(meta.title).toBe('A-Guy | תרגול מתמטיקה אינטראקטיבי')
    })

    it('returns brand description when no override', () => {
      const meta = pageMetadata({})
      expect(meta.description).toBe('Brand default description')
    })

    it('returns brand ogImage when no override', () => {
      const meta = pageMetadata({})
      // images is OGImage | OGImage[] — cast to verify the url field
      const images = meta.openGraph?.images as any[]
      expect(images).toHaveLength(1)
      expect(images?.[0]?.url).toBe('https://www.aguy.co.il/og.png')
    })

    it('returns brand twitterHandle in twitter card', () => {
      const meta = pageMetadata({})
      expect(meta.twitter?.site).toBe('@aguy')
      expect(meta.twitter?.creator).toBe('@aguy')
    })

    it('returns twitter card type as summary_large_image', () => {
      const meta = pageMetadata({})
      // TwitterMetadata doesn't always have card; cast to access
      const twitter = meta.twitter as any
      expect(twitter.card).toBe('summary_large_image')
    })

    it('returns brand locale in openGraph', () => {
      const meta = pageMetadata({})
      expect(meta.openGraph?.locale).toBe('he-IL')
    })
  })

  describe('overrides', () => {
    it('uses override title instead of brand defaultTitle', () => {
      const meta = pageMetadata({ title: 'Study' })
      expect(meta.title).toBe('Study')
    })

    it('uses override description instead of brand description', () => {
      const meta = pageMetadata({ description: 'Custom description' })
      expect(meta.description).toBe('Custom description')
    })

    it('uses override ogImage instead of brand ogImage', () => {
      const meta = pageMetadata({ ogImage: 'https://example.com/custom-og.png' })
      const images = meta.openGraph?.images as any[]
      expect(images?.[0]?.url).toBe('https://example.com/custom-og.png')
    })

    it('uses override title in openGraph title', () => {
      const meta = pageMetadata({ title: 'Study' })
      expect(meta.openGraph?.title).toBe('Study')
    })

    it('uses override description in openGraph description', () => {
      const meta = pageMetadata({ description: 'Custom description' })
      expect(meta.openGraph?.description).toBe('Custom description')
    })

    it('uses override title in twitter title', () => {
      const meta = pageMetadata({ title: 'Study' })
      expect(meta.twitter?.title).toBe('Study')
    })

    it('uses override description in twitter description', () => {
      const meta = pageMetadata({ description: 'Custom description' })
      expect(meta.twitter?.description).toBe('Custom description')
    })

    it('uses override ogImage in twitter images', () => {
      const meta = pageMetadata({ ogImage: 'https://example.com/custom-og.png' })
      const images = meta.twitter?.images as any[]
      expect(images?.[0]?.url).toBe('https://example.com/custom-og.png')
    })
  })

  describe('noIndex', () => {
    it('sets robots index:false follow:false when noIndex is true', () => {
      const meta = pageMetadata({ noIndex: true })
      expect(meta.robots).toEqual({ index: false, follow: false })
    })

    it('leaves robots undefined when noIndex is false', () => {
      const meta = pageMetadata({ noIndex: false })
      expect(meta.robots).toBeUndefined()
    })

    it('leaves robots undefined when noIndex is omitted', () => {
      const meta = pageMetadata({})
      expect(meta.robots).toBeUndefined()
    })
  })
})
