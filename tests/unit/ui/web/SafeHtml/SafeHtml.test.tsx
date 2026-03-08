// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import { SafeHtml } from '@/ui/web/SafeHtml'

afterEach(cleanup)

describe('SafeHtml', () => {
  describe('basic rendering', () => {
    it('renders sanitized HTML content', () => {
      const { container } = render(<SafeHtml html="<p>Hello <strong>world</strong></p>" />)
      const div = container.firstElementChild as HTMLElement
      expect(div.innerHTML).toBe('<p>Hello <strong>world</strong></p>')
    })

    it('returns null for empty html', () => {
      const { container } = render(<SafeHtml html="" />)
      expect(container.firstElementChild).toBeNull()
    })

    it('returns null for whitespace-only html', () => {
      const { container } = render(<SafeHtml html="   " />)
      expect(container.firstElementChild).toBeNull()
    })

    it('strips disallowed tags (script)', () => {
      const { container } = render(<SafeHtml html='<p>Safe</p><script>alert("xss")</script>' />)
      const div = container.firstElementChild as HTMLElement
      expect(div.innerHTML).toBe('<p>Safe</p>')
      expect(div.innerHTML).not.toContain('script')
    })

    it('preserves table elements', () => {
      const html =
        '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>'
      const { container } = render(<SafeHtml html={html} />)
      const div = container.firstElementChild as HTMLElement
      expect(div.querySelector('table')).not.toBeNull()
      expect(div.querySelector('th')?.textContent).toBe('Header')
      expect(div.querySelector('td')?.textContent).toBe('Cell')
    })
  })

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" className="custom-class text-sm" />)
      const div = container.firstElementChild as HTMLElement
      expect(div.className).toBe('custom-class text-sm')
    })

    it('renders without className attribute when not provided', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" />)
      const div = container.firstElementChild as HTMLElement
      // When no className and no prose, the className should be undefined/empty
      expect(div.hasAttribute('class')).toBe(false)
    })
  })

  describe('enableProse prop', () => {
    it('does NOT add prose classes by default', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" />)
      const div = container.firstElementChild as HTMLElement
      expect(div.className).not.toContain('prose')
    })

    it('adds prose classes when enableProse is true', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" enableProse />)
      const div = container.firstElementChild as HTMLElement
      expect(div.className).toContain('prose')
      expect(div.className).toContain('prose-slate')
      expect(div.className).toContain('dark:prose-invert')
      expect(div.className).toContain('max-w-none')
    })

    it('does NOT add prose classes when enableProse is false', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" enableProse={false} />)
      const div = container.firstElementChild as HTMLElement
      expect(div.className).not.toContain('prose')
    })

    it('merges prose classes with custom className', () => {
      const { container } = render(
        <SafeHtml html="<p>Test</p>" enableProse className="text-xl mb-4" />,
      )
      const div = container.firstElementChild as HTMLElement
      expect(div.className).toContain('prose')
      expect(div.className).toContain('text-xl')
      expect(div.className).toContain('mb-4')
    })

    it('allows className to override prose defaults', () => {
      const { container } = render(
        <SafeHtml html="<p>Test</p>" enableProse className="prose-lg max-w-md" />,
      )
      const div = container.firstElementChild as HTMLElement
      // Both should be present — CSS specificity handles the actual override at render time
      expect(div.className).toContain('prose')
      expect(div.className).toContain('prose-lg')
      expect(div.className).toContain('max-w-md')
    })
  })

  describe('style prop', () => {
    it('applies inline style', () => {
      const { container } = render(<SafeHtml html="<p>Test</p>" style={{ fontSize: '12px' }} />)
      const div = container.firstElementChild as HTMLElement
      expect(div.style.fontSize).toBe('12px')
    })
  })

  describe('security', () => {
    it('adds rel="noopener noreferrer" to links with target', () => {
      const { container } = render(
        <SafeHtml html='<a href="https://example.com" target="_blank">Link</a>' />,
      )
      const link = container.querySelector('a')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('strips onclick and other event handlers', () => {
      const { container } = render(<SafeHtml html='<p onclick="alert(1)">Clickable</p>' />)
      const p = container.querySelector('p')
      expect(p?.getAttribute('onclick')).toBeNull()
    })
  })
})
