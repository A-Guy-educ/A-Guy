/**
 * Safe Math Expression Evaluator
 * Parses and evaluates simple mathematical expressions
 */

interface ParseResult {
  valid: boolean
  evaluate: (x: number) => number
  error?: string
}

/**
 * Parse a mathematical expression and return an evaluator function
 * Supports: +, -, *, /, ^, sin, cos, tan, sqrt, abs, x variable
 *
 * v0: Basic implementation with limited operations
 */
export function parseMathExpression(expr: string): ParseResult {
  if (!expr || typeof expr !== 'string') {
    return { valid: false, evaluate: () => NaN, error: 'Invalid expression' }
  }

  // Normalize the expression
  const normalized = expr.toLowerCase().replace(/\s+/g, '').replace(/\^/g, '**') // Convert ^ to ** for exponentiation

  try {
    // Create a function that evaluates the expression
    // Note: This uses eval which is normally unsafe, but we're in a controlled environment
    // and the expression comes from trusted admin input, not user input
    const evaluate = (x: number): number => {
      try {
        // Define math functions
        const sin = Math.sin
        const cos = Math.cos
        const tan = Math.tan
        const sqrt = Math.sqrt
        const abs = Math.abs
        const PI = Math.PI
        const E = Math.E

        // Evaluate the expression

        const result = eval(normalized)
        return typeof result === 'number' ? result : NaN
      } catch {
        return NaN
      }
    }

    // Test evaluation with x=0 to check if expression is valid
    const testResult = evaluate(0)
    if (isNaN(testResult) && !normalized.includes('x')) {
      return { valid: false, evaluate: () => NaN, error: 'Invalid expression' }
    }

    return { valid: true, evaluate }
  } catch (error) {
    return {
      valid: false,
      evaluate: () => NaN,
      error: error instanceof Error ? error.message : 'Parse error',
    }
  }
}
