// @vitest-environment jsdom
/**
 * Unit Tests for HtmlBlockRenderer Component
 *
 * Tests that verify HTML blocks with <style> tags and id attributes
 * are preserved during sanitization.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { HtmlBlockRenderer } from '@/ui/web/exerciserenderer/blocks/HtmlBlockRenderer'
import { afterEach, describe, it, expect } from 'vitest'

afterEach(() => {
  cleanup()
})

describe('HtmlBlockRenderer', () => {
  describe('Style Tag Preservation', () => {
    it('should preserve <style> tags in HTML block content', async () => {
      const block = {
        type: 'html' as const,
        html: '<div id="test"><style>#test { color: red; }</style></div>',
      }

      const { container } = render(<HtmlBlockRenderer block={block} />)

      await waitFor(() => {
        const styleElements = container.querySelectorAll('style')
        expect(styleElements.length).toBeGreaterThan(0)
      })
    })

    it('should preserve id attribute for CSS styling hooks', async () => {
      const block = {
        type: 'html' as const,
        html: '<div id="hero">Content</div>',
      }

      const { container } = render(<HtmlBlockRenderer block={block} />)

      await waitFor(() => {
        const div = container.querySelector('#hero')
        expect(div).not.toBeNull()
      })
    })
  })
})
