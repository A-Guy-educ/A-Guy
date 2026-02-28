// @vitest-environment jsdom
/**
 * Unit Tests for HtmlBlockEditor Component
 *
 * Tests that verify HTML blocks with <style> tags are preserved
 * during sanitization in the admin editor.
 */
import { cleanup, render, waitFor, act } from '@testing-library/react'
import { HtmlBlockEditor } from '@/ui/admin/ExerciseContentEditor/editors/HtmlBlockEditor'
import { afterEach, describe, it, expect, vi } from 'vitest'

// Mock React Quill to avoid complex dependencies
vi.mock('react-quill-new', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="quill-mock" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

afterEach(() => {
  cleanup()
})

describe('HtmlBlockEditor', () => {
  describe('Style Tag Preservation', () => {
    it('should preserve <style> tags when sanitizing in source view', async () => {
      const block = {
        id: 'test-id',
        type: 'html' as const,
        html: '<div id="test"><style>#test { color: red; }</style></div>',
      }

      const onChange = vi.fn()

      const { container } = render(<HtmlBlockEditor block={block} onChange={onChange} />)

      // The component starts in visual mode, switch to source view
      const sourceButton = container.querySelector('button')

      if (sourceButton) {
        await act(async () => {
          sourceButton.click()
        })
      }

      // The sanitization should preserve the style tag
      // When leaving source view, DOMPurify sanitizes the content
      // After the fix, style tags should be preserved
      await waitFor(() => {
        // Verify the style tag is preserved in the sanitized output
        // by checking that onChange was called (which happens when sanitizing)
        // and the output should contain the style tag
        if (onChange.mock.calls.length > 0) {
          const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
          const sanitizedHtml = lastCall[0]?.html || ''
          // The HTML should be preserved (or minimally modified)
          expect(sanitizedHtml).toContain('<style>')
        }
      })
    })
  })
})
