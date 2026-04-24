/**
 * @fileType utility
 * @domain exercises
 * @pattern math-expression-parser
 * @ai-summary Safe math expression evaluator using mathjs to prevent code injection
 */

import { parse } from 'mathjs'

interface ParseResult {
  valid: boolean
  evaluate: (x: number) => number
  error?: string
}

/**
 * Parse a mathematical expression and return an evaluator function
 * Supports: +, -, *, /, ^, sin, cos, tan, sqrt, abs, x variable
 *
 * Uses mathjs for safe evaluation (no eval()) to prevent code injection
 */
export function parseMathExpression(expr: string): ParseResult {
  if (!expr || typeof expr !== 'string') {
    return { valid: false, evaluate: () => NaN, error: 'Invalid expression' }
  }

  // Normalize the expression (mathjs uses ^ for exponentiation natively)
  const normalized = expr.toLowerCase().replace(/\s+/g, '')

  try {
    // Pre-validate the expression by attempting to evaluate with x=0
    // This catches syntax errors before we return the evaluator
    const compiled = parse(normalized).compile()
    const scope = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      abs: Math.abs,
      log: Math.log,
      log10: Math.log10,
      exp: Math.exp,
      pow: Math.pow,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      PI: Math.PI,
      E: Math.E,
    }
    const testResult = compiled.evaluate({ ...scope, x: 0 })
    if (typeof testResult !== 'number' || Number.isNaN(testResult)) {
      if (!normalized.includes('x')) {
        return { valid: false, evaluate: () => NaN, error: 'Invalid expression' }
      }
    }

    const evaluateFn = (x: number): number => {
      try {
        const result = compiled.evaluate({ ...scope, x })
        return typeof result === 'number' ? result : NaN
      } catch {
        return NaN
      }
    }

    return { valid: true, evaluate: evaluateFn }
  } catch (error) {
    return {
      valid: false,
      evaluate: () => NaN,
      error: error instanceof Error ? error.message : 'Parse error',
    }
  }
}
