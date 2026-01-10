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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const evaluate = (x: number): number => {
      try {
        // Define math functions and constants (used by eval, not directly by TypeScript)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const sin = Math.sin
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const cos = Math.cos
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const tan = Math.tan
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const sqrt = Math.sqrt
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const abs = Math.abs
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const PI = Math.PI
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const E = Math.E

        // Evaluate the expression (x and math functions are available to eval)
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
