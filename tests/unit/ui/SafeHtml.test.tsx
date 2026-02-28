// @vitest-environment jsdom
/**
 * Unit Tests for SafeHtml Component
 *
 * Tests that verify HTML content with <style> tags and id attributes
 * are preserved during sanitization.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { afterEach, describe, it, expect } from 'vitest'

afterEach(() => {
  cleanup()
})

describe('SafeHtml', () => {
  describe('Style Tag Preservation', () => {
    it('should preserve <style> tags in HTML content', async () => {
      const htmlWithStyle = '<div id="test"><style>#test { color: red; }</style></div>'

      const { container } = render(<SafeHtml html={htmlWithStyle} />)

      await waitFor(() => {
        // After fix, style tag should be preserved in the output
        const styleElements = container.querySelectorAll('style')
        expect(styleElements.length).toBeGreaterThan(0)
      })
    })

    it('should preserve id attribute for CSS styling hooks', async () => {
      const htmlWithId = '<div id="hero">Content</div>'

      const { container } = render(<SafeHtml html={htmlWithId} />)

      await waitFor(() => {
        const div = container.querySelector('#hero')
        expect(div).not.toBeNull()
      })
    })
  })
})
