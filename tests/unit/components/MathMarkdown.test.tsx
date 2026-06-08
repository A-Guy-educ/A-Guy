// @vitest-environment jsdom
import { MathMarkdown } from '@/ui/web/shared'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('MathMarkdown', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  describe('Hebrew Unicode in math delimiters — KaTeX strict-mode warnings', () => {
    it('does not emit console warnings for Hebrew characters inside inline math delimiters', () => {
      // Hebrew text inside inline math delimiters — KaTeX warns because Hebrew letters
      // are not valid KaTeX tokens. This tests the fix: MathMarkdown passes
      // strict: false to rehype-katex so these warnings are suppressed.
      render(<MathMarkdown content="פתרון: $x^2 + חזקה$ וגם $y^3$" />)

      const katexWarnings = warnSpy.mock.calls.filter((call: unknown[]) =>
        call.some(
          (arg: unknown) =>
            typeof arg === 'string' && (arg.includes('Unicode') || arg.includes('strict')),
        ),
      )
      expect(katexWarnings).toHaveLength(0)
    })

    it('does not emit console warnings for Hebrew characters inside block math delimiters', () => {
      render(<MathMarkdown content={`נוסחה:\n$$\nx^2 + y^2 + חזקה\n$$`} />)

      const katexWarnings = warnSpy.mock.calls.filter((call: unknown[]) =>
        call.some(
          (arg: unknown) =>
            typeof arg === 'string' && (arg.includes('Unicode') || arg.includes('strict')),
        ),
      )
      expect(katexWarnings).toHaveLength(0)
    })
  })

  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content="The value is $E = mc^2$ here" />)

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<MathMarkdown content="Given $x = 5$ and $y = 10$" />)

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(<MathMarkdown content={'$$\nx = \\frac{-b}{2a}\n$$'} />)

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })
  })

  describe('Custom components', () => {
    it('applies custom component overrides when provided', () => {
      const { container } = render(
        <MathMarkdown
          content="Hello world"
          components={{
            p: ({ children }) => <p data-testid="custom-p">{children}</p>,
          }}
        />,
      )

      expect(container.querySelector('[data-testid="custom-p"]')).not.toBeNull()
    })

    it('renders default elements when no components provided', () => {
      const { container } = render(<MathMarkdown content="Hello world" />)

      expect(container.querySelector('p')).not.toBeNull()
      expect(container.querySelector('[data-testid]')).toBeNull()
    })
  })

  describe('className', () => {
    it('applies className to wrapper div', () => {
      const { container } = render(<MathMarkdown content="test" className="my-custom-class" />)

      expect(container.querySelector('.my-custom-class')).not.toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('renders without errors when content is empty', () => {
      const { container } = render(<MathMarkdown content="" />)
      expect(container.firstElementChild).not.toBeNull()
    })

    it('does NOT normalize LaTeX delimiters (that is chat-specific)', () => {
      // MathMarkdown does NOT call normalizeLatexDelimiters.
      // \[...\] is NOT recognized by remark-math, so no KaTeX rendered.
      // This verifies the shared component stays generic.
      const { container } = render(<MathMarkdown content="\\[ x^2 \\]" />)

      expect(container.querySelector('.katex')).toBeNull()
    })
  })
})
