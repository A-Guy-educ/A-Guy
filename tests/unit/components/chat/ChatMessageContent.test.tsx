// @vitest-environment jsdom
import { ChatMessageContent } from '@/components/chat'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('ChatMessageContent', () => {
  describe('Plain text (no math)', () => {
    it('renders plain text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="Hello world" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
      expect(container.textContent).toContain('Hello world')
    })

    it('renders Hebrew text without math wrappers', () => {
      const { container } = render(<ChatMessageContent content="שלום עולם" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
    })

    it('does NOT wrap undelimited math-like text', () => {
      const { container } = render(<ChatMessageContent content="x + y = z without delimiters" />)

      expect(container.querySelector('.math-inline')).toBeNull()
      expect(container.querySelector('.math-block')).toBeNull()
    })
  })

  describe('Inline math RTL isolation', () => {
    it('wraps inline math with LTR isolation', () => {
      const { container } = render(
        <ChatMessageContent content="הנוסחה היא $E = mc^2$ והיא חשובה" />,
      )

      const inlineMath = container.querySelector('.math-inline')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.getAttribute('dir')).toBe('ltr')
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<ChatMessageContent content="נתון $x = 5$ ו-$y = 10$" />)

      const inlineMaths = container.querySelectorAll('.math-inline[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })

    it('handles math-only inline content', () => {
      const { container } = render(<ChatMessageContent content="$\\pi$" />)

      const inlineMath = container.querySelector('.math-inline[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(
        // Use $$ on separate lines with blank lines for proper block math detection
        <ChatMessageContent content={'הפתרון:\n\n$$\nx = \\frac{-b}{2a}\n$$\n'} />,
      )

      const blockMath = container.querySelector('.math-block')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.getAttribute('dir')).toBe('ltr')
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders multi-line block equations', () => {
      const { container } = render(
        // Use $$ on separate lines with blank lines for proper block math detection
        <ChatMessageContent
          content={'$$\n\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}\n$$'}
        />,
      )

      const blockMath = container.querySelector('.math-block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
    })
  })

  describe('Mixed content', () => {
    it('handles Hebrew with inline math only', () => {
      const { container } = render(
        <ChatMessageContent content={'בעיה: מצא $x$\n\nתשובה: $x = 2$'} />,
      )

      const inlineMaths = container.querySelectorAll('.math-inline[dir="ltr"]')
      const blockMaths = container.querySelectorAll('.math-block[dir="ltr"]')

      expect(inlineMaths.length).toBe(2)
      expect(blockMaths.length).toBe(0)
    })

    it('handles Hebrew with inline and block math', () => {
      const { container } = render(
        // Use $$ on separate lines with blank lines for proper block math detection
        <ChatMessageContent content={'בעיה: מצא $x$\n\n$$\nx^2 = 4\n$$\n\nתשובה: $x = 2$'} />,
      )

      const inlineMaths = container.querySelectorAll('.math-inline[dir="ltr"]')
      const blockMaths = container.querySelectorAll('.math-block[dir="ltr"]')

      expect(inlineMaths.length).toBe(2)
      expect(blockMaths.length).toBe(1)
    })
  })

  describe('Edge cases', () => {
    it('handles empty content', () => {
      const { container } = render(<ChatMessageContent content="" />)
      expect(container.querySelector('.chat-message-content')).not.toBeNull()
    })
  })
})
