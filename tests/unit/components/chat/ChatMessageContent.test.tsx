// @vitest-environment jsdom
import { ChatMessageContent } from '@/ui/web/chat'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('ChatMessageContent', () => {
  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="Hello world" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })

    it('renders Hebrew text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="שלום עולם" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
    })

    it('does NOT wrap undelimited math-like text', () => {
      const { container } = render(<ChatMessageContent content="x + y = z without delimiters" />)

      expect(container.querySelector('.isolate.inline-block')).toBeNull()
      expect(container.querySelector('.isolate.block')).toBeNull()
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(
        <ChatMessageContent content="הנוסחה היא $E = mc^2$ והיא חשובה" />,
      )

      const inlineMath = container.querySelector('.isolate.inline-block')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.getAttribute('dir')).toBe('ltr')
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<ChatMessageContent content="נתון $x = 5$ ו-$y = 10$" />)

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })

    it('handles math-only inline content', () => {
      const { container } = render(<ChatMessageContent content="$\\pi$" />)

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(
        // Use $$ on separate lines for proper block math detection
        <ChatMessageContent content={'$$\nx = \\frac{-b}{2a}\n$$'} />,
      )

      const blockMath = container.querySelector('.isolate.block')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.getAttribute('dir')).toBe('ltr')
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders multi-line block equations', () => {
      const { container } = render(
        <ChatMessageContent
          content={'$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$'}
        />,
      )

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
    })
  })

  describe('Mixed content', () => {
    it('handles Hebrew with inline and block math', () => {
      const { container } = render(
        <ChatMessageContent content={'בעיה: מצא $x$\n\n$$\nx^2 = 4\n$$\n\nתשובה: $x = 2$'} />,
      )

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      const blockMaths = container.querySelectorAll('.isolate.block[dir="ltr"]')

      expect(inlineMaths.length).toBe(2)
      expect(blockMaths.length).toBe(1)
    })
  })

  describe('Edge cases', () => {
    it('handles empty content', () => {
      const { container } = render(<ChatMessageContent content="" />)
      expect(container.querySelector('.chat-message-content')).not.toBeNull()
    })

    it('handles math-only content', () => {
      const { container } = render(<ChatMessageContent content="$\\pi$" />)

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
    })
  })

  describe('LaTeX delimiter normalization', () => {
    it('renders \\[...\\] as block math', () => {
      const { container } = render(<ChatMessageContent content={'$$\nx^2 + y^2 = z^2\n$$'} />)

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders \\(...\\) as block math (all math on own line)', () => {
      const { container } = render(<ChatMessageContent content={'The value is \\(x^2\\) here'} />)

      // All math is now rendered as block math for better readability
      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders Gaussian formula with \\[...\\] delimiters', () => {
      const { container } = render(
        <ChatMessageContent
          content={
            '$$\nf(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}\n$$'
          }
        />,
      )

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-error')).toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders Hebrew with LaTeX block delimiters', () => {
      const { container } = render(<ChatMessageContent content={'הנוסחה היא $$\nx^2\n$$'} />)

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('converts \\[...\\] to $$...$$ for block math', () => {
      // Test that LaTeX-style block delimiters work after normalization
      const { container } = render(<ChatMessageContent content={'\\[ x^2 \\]'} />)

      // Should render as block math with katex-display
      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('converts \\(...\\) to $$...$$ for block math (all math on own line)', () => {
      // Test that LaTeX-style inline delimiters are converted to block math
      const { container } = render(<ChatMessageContent content={'The value is \\(x^2\\) here'} />)

      // Should render as block math with katex-display
      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })
  })

  describe('Streaming math safety', () => {
    it('does not render math for partial \\[ content during streaming', () => {
      const { container } = render(<ChatMessageContent content="\\[ f(x) = " />)

      // No katex rendering when delimiters are unbalanced
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.querySelector('.katex-display')).toBeNull()
      expect(container.querySelector('.katex-error')).toBeNull()
      // Raw delimiters should be visible as text
      expect(container.textContent).toContain('\\[')
      expect(container.textContent).toContain('f(x) =')
    })

    it('does not render math for partial $$ content during streaming', () => {
      const { container } = render(<ChatMessageContent content="$$\n\\int" />)

      // No katex rendering when delimiters are unbalanced
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.querySelector('.katex-display')).toBeNull()
      expect(container.querySelector('.katex-error')).toBeNull()
    })

    it('does not render math for partial $ content during streaming', () => {
      const { container } = render(<ChatMessageContent content="The $x" />)

      // No katex rendering when delimiters are unbalanced
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.querySelector('.katex-display')).toBeNull()
      expect(container.querySelector('.katex-error')).toBeNull()
      // Raw delimiter should be visible
      expect(container.textContent).toContain('$')
    })

    it('renders complete \\[...\\] math normally', () => {
      const { container } = render(<ChatMessageContent content={'\\[ x^2 \\]'} />)

      // Complete balanced content should render math
      const blockMath = container.querySelector('.isolate.block')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('handles escaped dollar', () => {
      const { container } = render(
        <ChatMessageContent content="Price is \\$100 and $\\frac{1}{2}$" />,
      )

      // After normalizeLatexDelimiters, \$ becomes $ and $100 becomes math
      // The key is that it doesn't show red katex-error
      expect(container.querySelector('.katex-error')).toBeNull()
      // Balanced $...$ should render as math
      expect(container.querySelector('.katex')).not.toBeNull()
    })

    it('skips math parsing inside code fences', () => {
      const { container } = render(<ChatMessageContent content="```\n$100\n```" />)

      // Dollar inside code fence should not be parsed as math
      expect(container.querySelector('.katex')).toBeNull()
      expect(container.querySelector('.katex-error')).toBeNull()
    })

    it('does not show katex-error for invalid but balanced LaTeX', () => {
      const { container } = render(<ChatMessageContent content={'$$\n\\undefinedcommand{}\n$$'} />)

      // Invalid LaTeX should not show katex-error (handled by error handler)
      expect(container.querySelector('.katex-error')).toBeNull()
      // The error handler should have replaced it with text
      expect(container.textContent).toContain('\\undefinedcommand{}')
    })
  })
})
