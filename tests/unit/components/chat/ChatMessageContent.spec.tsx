// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatMessageContent } from '@/components/chat'

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

      const inlineMath = container.querySelector('.isolate.inline-block[dir="ltr"]')
      expect(inlineMath).not.toBeNull()
      expect(inlineMath?.getAttribute('dir')).toBe('ltr')
      expect(inlineMath?.querySelector('.katex')).not.toBeNull()
    })

    it('wraps multiple inline math expressions', () => {
      const { container } = render(<ChatMessageContent content="נתון $x = 5$ ו-$y = 10$" />)

      const inlineMaths = container.querySelectorAll('.isolate.inline-block[dir="ltr"]')
      expect(inlineMaths.length).toBe(2)
    })
  })

  describe('Block math RTL isolation', () => {
    it('wraps block math with LTR isolation', () => {
      const { container } = render(
        <ChatMessageContent content={'הפתרון:\n\n$$x = \\frac{-b}{2a}$$'} />,
      )

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
      expect(blockMath?.getAttribute('dir')).toBe('ltr')
      expect(blockMath?.querySelector('.katex-display')).not.toBeNull()
    })

    it('renders multi-line block equations', () => {
      const { container } = render(
        <ChatMessageContent content={'$$\\begin{align}\na &= b \\\\\nc &= d\n\\end{align}$$'} />,
      )

      const blockMath = container.querySelector('.isolate.block[dir="ltr"]')
      expect(blockMath).not.toBeNull()
    })
  })

  describe('Mixed content', () => {
    it('handles Hebrew with both inline and block math', () => {
      const { container } = render(
        <ChatMessageContent content={'בעיה: מצא $x$\n\n$$x^2 = 4$$\n\nתשובה: $x = 2$'} />,
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
})
