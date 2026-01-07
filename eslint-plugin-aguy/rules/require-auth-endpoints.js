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

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require authentication checks in API endpoints',
      category: 'Security',
      recommended: true,
    },
    messages: {
      missingAuth: 'API endpoint "{{name}}" is missing authentication check. Add payload.auth() or document why auth is not needed.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    
    // Only check API route files
    if (!filename.includes('/api/') && !filename.includes('/endpoints/')) {
      return {}
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
              const hasAuthCheck = this.checkForAuthInBody(functionBody)
              
              if (!hasAuthCheck) {
                context.report({
                  node: node.declaration,
                  messageId: 'missingAuth',
                  data: {
                    name: functionName
                  }
                })
              }
            }
          }
        }
      }
    }
  },

  checkForAuthInBody(body) {
    // Simple heuristic: look for payload.auth or req.user checks
    const sourceCode = body.range ? body.parent.getSourceCode().getText(body) : ''
    
    return (
      sourceCode.includes('payload.auth') ||
      sourceCode.includes('req.user') ||
      sourceCode.includes('getPayload') ||
      sourceCode.includes('// public endpoint') ||
      sourceCode.includes('// no auth required')
    )
  }
}
