import { areMathDelimitersBalanced } from '@/ui/web/chat/ChatMessageContent/are-math-delimiters-balanced'
import { describe, expect, it } from 'vitest'

describe('areMathDelimitersBalanced', () => {
  describe('Balanced (return true)', () => {
    it('returns true for plain text', () => {
      expect(areMathDelimitersBalanced('Hello world')).toBe(true)
    })

    it('returns true for empty string', () => {
      expect(areMathDelimitersBalanced('')).toBe(true)
    })

    it('returns true for inline $...$', () => {
      expect(areMathDelimitersBalanced('The $x^2$ value')).toBe(true)
    })

    it('returns true for block $$...$$', () => {
      expect(areMathDelimitersBalanced('$$\nf(x)\n$$')).toBe(true)
    })

    it('returns true for single backslash [', () => {
      expect(areMathDelimitersBalanced('\\[ f(x) \\]')).toBe(true)
    })

    it('returns true for single backslash (', () => {
      expect(areMathDelimitersBalanced('\\( x^2 \\)')).toBe(true)
    })

    it('returns true for double backslash \\[', () => {
      expect(areMathDelimitersBalanced('\\\\[ f(x) \\\\]')).toBe(true)
    })

    it('returns true for double backslash \\(', () => {
      expect(areMathDelimitersBalanced('\\\\( x^2 \\\\)')).toBe(true)
    })

    it('returns true for triple backslash \\\\[', () => {
      expect(areMathDelimitersBalanced('\\\\\\[ f(x) \\\\]')).toBe(true)
    })

    it('returns true for triple backslash \\\\(', () => {
      expect(areMathDelimitersBalanced('\\\\\\( x^2 \\\\\\)')).toBe(true)
    })

    it('returns true for multiple expressions', () => {
      expect(areMathDelimitersBalanced('$a$ and $b$ and $$c$$')).toBe(true)
    })

    it('returns true for escaped dollar (1 backslash)', () => {
      expect(areMathDelimitersBalanced('Price is \\$100 and $\\frac{1}{2}$')).toBe(true)
    })

    it('returns true for escaped dollar (2 backslashes)', () => {
      expect(areMathDelimitersBalanced('Price is \\\\$100')).toBe(true)
    })

    it('returns true for escaped dollar (3 backslashes)', () => {
      expect(areMathDelimitersBalanced('Price is \\\\\\$100')).toBe(true)
    })

    it('returns true when inline code is skipped', () => {
      expect(areMathDelimitersBalanced('`$not math$`')).toBe(true)
    })

    it('returns true when fenced code block is skipped (start-of-string)', () => {
      expect(areMathDelimitersBalanced('```\n$100\n```')).toBe(true)
    })

    it('returns true when fenced code block is skipped (after newline)', () => {
      expect(areMathDelimitersBalanced('text\n```\n$100\n```')).toBe(true)
    })

    it('returns true when fenced code block with info string is skipped', () => {
      expect(areMathDelimitersBalanced('```typescript\n$100\n```')).toBe(true)
    })

    it('returns true when tilde fence is skipped', () => {
      expect(areMathDelimitersBalanced('~~~\n$x$\n~~~')).toBe(true)
    })

    it('returns true when closing fence >= opening length', () => {
      expect(areMathDelimitersBalanced('```\n$x\n`````')).toBe(true)
    })

    it('returns true for Hebrew with math', () => {
      expect(areMathDelimitersBalanced('הפתרון הוא $\\frac{a}{b}$')).toBe(true)
    })

    it('returns true for content with only backslashes', () => {
      expect(areMathDelimitersBalanced('\\\\')).toBe(true)
    })
  })

  describe('Unbalanced (return false)', () => {
    it('returns false for opening $ only', () => {
      expect(areMathDelimitersBalanced('The $x^2')).toBe(false)
    })

    it('returns false for opening $$ only', () => {
      expect(areMathDelimitersBalanced('$$\nf(x)')).toBe(false)
    })

    it('returns false for opening \\[ only', () => {
      expect(areMathDelimitersBalanced('\\[ f(x)')).toBe(false)
    })

    it('returns false for opening \\( only', () => {
      expect(areMathDelimitersBalanced('\\( x^2')).toBe(false)
    })

    it('returns false for opening \\\\[ only', () => {
      expect(areMathDelimitersBalanced('\\\\[ f(x)')).toBe(false)
    })

    it('returns false for opening \\\\\\[ only', () => {
      expect(areMathDelimitersBalanced('\\\\\\[ f(x)')).toBe(false)
    })

    it('returns false for partial streaming content', () => {
      expect(areMathDelimitersBalanced('\\[ f(x) = \\frac{1')).toBe(false)
    })

    it('returns false for one balanced + one open', () => {
      expect(areMathDelimitersBalanced('$a$ and $b')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('handles trailing backslash at end-of-string without crashing', () => {
      expect(areMathDelimitersBalanced('text\\')).toBe(true)
    })

    it('handles content with only backslashes', () => {
      expect(areMathDelimitersBalanced('\\\\')).toBe(true)
    })

    it('handles multiple $ pairs', () => {
      expect(areMathDelimitersBalanced('$a$ $b$ $c$')).toBe(true)
    })

    it('handles bare parenthesis as plain text in normal state', () => {
      expect(areMathDelimitersBalanced('hello (world)')).toBe(true)
    })

    it('handles bare brackets as plain text in normal state', () => {
      expect(areMathDelimitersBalanced('hello [world]')).toBe(true)
    })
  })
})
