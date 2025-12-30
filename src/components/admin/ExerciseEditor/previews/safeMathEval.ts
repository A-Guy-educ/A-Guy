/**
 * Safe Math Expression Evaluator
 * Evaluates simple math expressions without using eval()
 * Supports: numbers, x variable, +, -, *, /, ^, parentheses
 */

const MAX_EXPRESSION_LENGTH = 80

/**
 * Tokenize a math expression
 */
function tokenize(expr: string): string[] {
  // Remove whitespace
  expr = expr.replace(/\s/g, '')

  // Match numbers (including decimals), operators, parentheses, and 'x'
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/^()]|x)/g)
  return tokens || []
}

/**
 * Convert infix to postfix (Shunting Yard algorithm)
 */
function infixToPostfix(tokens: string[]): string[] {
  const output: string[] = []
  const operators: string[] = []
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

  for (const token of tokens) {
    if (!isNaN(Number(token)) || token === 'x') {
      output.push(token)
    } else if (token === '(') {
      operators.push(token)
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') {
        output.push(operators.pop()!)
      }
      operators.pop() // Remove '('
    } else if (precedence[token]) {
      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        output.push(operators.pop()!)
      }
      operators.push(token)
    }
  }

  while (operators.length) {
    output.push(operators.pop()!)
  }

  return output
}

/**
 * Evaluate postfix expression with given x value
 */
function evaluatePostfix(postfix: string[], xValue: number): number {
  const stack: number[] = []

  for (const token of postfix) {
    if (token === 'x') {
      stack.push(xValue)
    } else if (!isNaN(Number(token))) {
      stack.push(Number(token))
    } else {
      const b = stack.pop()!
      const a = stack.pop()!

      switch (token) {
        case '+':
          stack.push(a + b)
          break
        case '-':
          stack.push(a - b)
          break
        case '*':
          stack.push(a * b)
          break
        case '/':
          if (b === 0) throw new Error('Division by zero')
          stack.push(a / b)
          break
        case '^':
          stack.push(Math.pow(a, b))
          break
      }
    }
  }

  return stack[0]
}

/**
 * Validate expression contains only safe characters
 */
function isExpressionSafe(expr: string): boolean {
  // Only allow: digits, decimal point, x, operators, parentheses, whitespace
  const safePattern = /^[\d.x+\-*/^()\s]*$/
  return safePattern.test(expr)
}

/**
 * Safe evaluation of math expression
 * Returns { valid: true, evaluate: (x) => y } on success
 * Returns { valid: false, error: string } on failure
 */
export function parseMathExpression(
  expr: string,
): { valid: true; evaluate: (x: number) => number } | { valid: false; error: string } {
  // Check length
  if (expr.length > MAX_EXPRESSION_LENGTH) {
    return { valid: false, error: `Expression too long (max ${MAX_EXPRESSION_LENGTH} chars)` }
  }

  // Check for safe characters
  if (!isExpressionSafe(expr)) {
    return { valid: false, error: 'Expression contains invalid characters' }
  }

  try {
    // Tokenize
    const tokens = tokenize(expr)
    if (tokens.length === 0) {
      return { valid: false, error: 'Empty expression' }
    }

    // Convert to postfix
    const postfix = infixToPostfix(tokens)

    // Test evaluation with x=0 to catch syntax errors early
    evaluatePostfix(postfix, 0)

    // Return evaluator function
    return {
      valid: true,
      evaluate: (x: number) => {
        try {
          const result = evaluatePostfix(postfix, x)
          // Check for invalid results
          if (!isFinite(result)) {
            return NaN
          }
          return result
        } catch {
          return NaN
        }
      },
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Invalid expression' }
  }
}
