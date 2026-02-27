import { describe, it, expect } from 'vitest'
import { HTML_BLOCK_PURIFY_CONFIG } from '@/lib/sanitize/config'

describe('HTML_BLOCK_PURIFY_CONFIG', () => {
  describe('ALLOWED_TAGS', () => {
    it('should include style tag for internal CSS', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('style')
    })

    it('should include SVG animation tags', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('animate')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('animatetransform')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('animatemotion')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('set')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('mpath')
    })

    it('should include SVG gradient tags', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('lineargradient')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('radialgradient')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('stop')
    })

    it('should include img tag for existing SafeHtml content', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_TAGS).toContain('img')
    })
  })

  describe('ALLOWED_ATTR', () => {
    it('should include SVG animation attributes', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('attributename')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('dur')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('repeatcount')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('repeatdur')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('begin')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('end')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('from')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('to')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('values')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('keytimes')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('keysplines')
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('calcmode')
    })

    it('should NOT include style attribute - inline styles must be blocked', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).not.toContain('style')
    })

    it('should include xlink:href for SVG link support', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.ALLOWED_ATTR).toContain('xlink:href')
    })
  })

  describe('FORBID_ATTR', () => {
    it('should include style attribute to block inline styles', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_ATTR).toContain('style')
    })

    it('should include target attribute', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_ATTR).toContain('target')
    })
  })

  describe('FORBID_TAGS', () => {
    it('should include script tag', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS).toContain('script')
    })

    it('should include iframe tag', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS).toContain('iframe')
    })

    it('should include other dangerous tags', () => {
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS).toContain('object')
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS).toContain('embed')
      expect(HTML_BLOCK_PURIFY_CONFIG.FORBID_TAGS).toContain('foreignobject')
    })
  })
})
