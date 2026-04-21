/**
 * Unit Tests for safeMathEval - Code Injection Prevention
 *
 * Tests:
 * - Basic math expressions evaluate correctly
 * - Variable x substitution works
 * - Math functions (sin, cos, sqrt, etc.) work
 * - Constants (PI, E) work
 * - Invalid expressions return valid: false
 * - Code injection attempts are prevented (no eval)
 */
import { describe, expect, it } from 'vitest'
import { parseMathExpression } from '@/ui/web/exerciserenderer/utils/safeMathEval'

describe('safeMathEval', () => {
  describe('basic arithmetic', () => {
    it('should evaluate simple addition', () => {
      const result = parseMathExpression('2 + 3')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })

    it('should evaluate simple subtraction', () => {
      const result = parseMathExpression('10 - 4')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(6)
    })

    it('should evaluate multiplication', () => {
      const result = parseMathExpression('3 * 4')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(12)
    })

    it('should evaluate division', () => {
      const result = parseMathExpression('15 / 3')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })

    it('should handle exponentiation with ^', () => {
      const result = parseMathExpression('2 ^ 3')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(8)
    })

    it('should handle operator precedence', () => {
      const result = parseMathExpression('2 + 3 * 4')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(14) // 2 + (3*4) = 14
    })

    it('should handle parentheses', () => {
      const result = parseMathExpression('(2 + 3) * 4')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(20)
    })
  })

  describe('variable x substitution', () => {
    it('should evaluate expressions with x', () => {
      const result = parseMathExpression('x + 5')
      expect(result.valid).toBe(true)
      expect(result.evaluate(3)).toBe(8)
      expect(result.evaluate(10)).toBe(15)
    })

    it('should evaluate x raised to power', () => {
      const result = parseMathExpression('x ^ 2')
      expect(result.valid).toBe(true)
      expect(result.evaluate(3)).toBe(9)
      expect(result.evaluate(5)).toBe(25)
    })

    it('should evaluate quadratic expression', () => {
      const result = parseMathExpression('2*x^2 + 3*x + 1')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(1)
      expect(result.evaluate(1)).toBe(6)
      expect(result.evaluate(2)).toBe(15)
    })
  })

  describe('math functions', () => {
    it('should evaluate sqrt', () => {
      const result = parseMathExpression('sqrt(16)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(4)
    })

    it('should evaluate sin', () => {
      const result = parseMathExpression('sin(0)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(0, 10)
    })

    it('should evaluate cos', () => {
      const result = parseMathExpression('cos(0)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(1, 10)
    })

    it('should evaluate abs', () => {
      const result = parseMathExpression('abs(-5)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })

    it('should evaluate log', () => {
      const result = parseMathExpression('log(10)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(2.302, 2)
    })

    it('should evaluate exp', () => {
      const result = parseMathExpression('exp(0)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(1, 10)
    })

    it('should evaluate floor', () => {
      const result = parseMathExpression('floor(4.7)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(4)
    })

    it('should evaluate ceil', () => {
      const result = parseMathExpression('ceil(4.2)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })

    it('should evaluate round', () => {
      const result = parseMathExpression('round(4.5)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })
  })

  describe('constants', () => {
    it('should evaluate PI', () => {
      const result = parseMathExpression('PI')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(Math.PI, 10)
    })

    it('should evaluate E (Euler number)', () => {
      const result = parseMathExpression('E')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(Math.E, 10)
    })

    it('should use PI in expressions', () => {
      const result = parseMathExpression('2 * PI')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(2 * Math.PI, 10)
    })
  })

  describe('whitespace normalization', () => {
    it('should handle expressions with spaces', () => {
      const result = parseMathExpression('  2   +   3  ')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })

    it('should handle newlines and tabs', () => {
      const result = parseMathExpression('2\t+\n3')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(5)
    })
  })

  describe('case normalization', () => {
    it('should handle uppercase functions', () => {
      const result = parseMathExpression('SQRT(16)')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(4)
    })

    it('should handle mixed case constants', () => {
      const result = parseMathExpression('pi + Pi + PI')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBeCloseTo(3 * Math.PI, 10)
    })
  })

  describe('invalid expressions', () => {
    it('should reject empty string', () => {
      const result = parseMathExpression('')
      expect(result.valid).toBe(false)
    })

    it('should reject null', () => {
      const result = parseMathExpression(null as unknown as string)
      expect(result.valid).toBe(false)
    })

    it('should reject undefined', () => {
      const result = parseMathExpression(undefined as unknown as string)
      expect(result.valid).toBe(false)
    })

    it('should reject non-string input', () => {
      const result = parseMathExpression(123 as unknown as string)
      expect(result.valid).toBe(false)
    })

    it('should reject syntax errors', () => {
      const result = parseMathExpression('2 +')
      expect(result.valid).toBe(false)
    })

    it('should reject unbalanced parentheses', () => {
      const result = parseMathExpression('(2 + 3')
      expect(result.valid).toBe(false)
    })

    it('should provide error message for invalid expressions', () => {
      const result = parseMathExpression('2 +')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('code injection prevention', () => {
    it('should not execute require() statement', () => {
      const result = parseMathExpression("require('child_process')")
      expect(result.valid).toBe(false)
    })

    it('should not execute process.exit()', () => {
      const result = parseMathExpression('process.exit()')
      expect(result.valid).toBe(false)
    })

    it('should not execute arbitrary JS code', () => {
      const result = parseMathExpression('(() => { throw new Error("hacked") })()')
      expect(result.valid).toBe(false)
    })

    it('should not execute inline scripts even with expression', () => {
      const result = parseMathExpression('x; require("fs")')
      expect(result.valid).toBe(false)
    })

    it('should not allow access to global objects', () => {
      const result = parseMathExpression('globalThis.process')
      expect(result.valid).toBe(false)
    })

    it('should not allow access to window object', () => {
      const result = parseMathExpression('window.location')
      expect(result.valid).toBe(false)
    })

    it('should not allow template literals with code', () => {
      const result = parseMathExpression('`${require("fs").readFileSync("/etc/passwd")}`')
      expect(result.valid).toBe(false)
    })

    it('should not allow spread operator for object access', () => {
      const result = parseMathExpression('{...require("fs")}')
      expect(result.valid).toBe(false)
    })

    it('should not allow function definitions', () => {
      const result = parseMathExpression('function() { return 1; }')
      expect(result.valid).toBe(false)
    })

    it('should not allow arrow functions', () => {
      const result = parseMathExpression('() => 1')
      expect(result.valid).toBe(false)
    })

    it('should not allow await expression', () => {
      const result = parseMathExpression('await fetch("http://evil.com")')
      expect(result.valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      const result = parseMathExpression('10 ^ 20')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(1e20)
    })

    it('should handle negative numbers', () => {
      const result = parseMathExpression('-5 + 3')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(-2)
    })

    it('should handle negative x values', () => {
      const result = parseMathExpression('x ^ 2')
      expect(result.valid).toBe(true)
      expect(result.evaluate(-3)).toBe(9)
    })

    it('should reject complex number results like sqrt(-1)', () => {
      const result = parseMathExpression('sqrt(-1)')
      // mathjs returns a complex number for sqrt(-1), not NaN
      // Our implementation correctly rejects non-finite real numbers
      expect(result.valid).toBe(false)
    })

    it('should handle zero as x value', () => {
      const result = parseMathExpression('x * 5')
      expect(result.valid).toBe(true)
      expect(result.evaluate(0)).toBe(0)
    })
  })
})
