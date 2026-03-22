/**
 * ESLint Rule: require-auth-endpoints
 *
 * Ensures API endpoints have authentication checks.
 *
 * @example
 * // ❌ BAD - No auth check
 * export async function POST(req: NextRequest) {
 *   const data = await req.json()
 *   // Missing: authentication check
 * }
 *
 * // ✅ GOOD - Auth check present
 * export async function POST(req: NextRequest) {
 *   const { user } = await payload.auth({ headers: req.headers })
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require authentication checks in API endpoints',
      category: 'Security',
      recommended: true,
    },
    messages: {
      missingAuth:
        'API endpoint "{{name}}" is missing authentication check. Add payload.auth() or document why auth is not needed.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()

    // Only check API route files
    if (!filename.includes('/api/') && !filename.includes('/endpoints/')) {
      return {}
    }

    /**
     * Check if a function body contains an authentication check.
     * Simple heuristic: look for payload.auth or req.user checks in the source text.
     */
    function checkForAuthInBody(body) {
      const sourceCode = context.getSourceCode()
      const text = sourceCode.getText(body)

      return (
        text.includes('payload.auth') ||
        text.includes('req.user') ||
        text.includes('getPayload') ||
        text.includes('// public endpoint') ||
        text.includes('// no auth required')
      )
    }

    return {
      // Check exported async functions (GET, POST, PUT, DELETE, PATCH)
      ExportNamedDeclaration(node) {
        if (
          node.declaration &&
          node.declaration.type === 'FunctionDeclaration' &&
          node.declaration.async === true
        ) {
          const functionName = node.declaration.id ? node.declaration.id.name : ''
          const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

          if (httpMethods.includes(functionName)) {
            // Check if function body contains auth check
            const functionBody = node.declaration.body

            if (functionBody && functionBody.type === 'BlockStatement') {
              const hasAuthCheck = checkForAuthInBody(functionBody)

              if (!hasAuthCheck) {
                context.report({
                  node: node.declaration,
                  messageId: 'missingAuth',
                  data: {
                    name: functionName,
                  },
                })
              }
            }
          }
        }
      },
    }
  },
}
export default rule
