/**
 * ESLint Rule: no-exec-sync
 *
 * Disallow execSync — use execFileSync for shell injection prevention.
 * execSync passes commands through the shell, enabling injection attacks.
 * execFileSync runs programs directly without shell interpretation.
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow execSync — use execFileSync for shell injection prevention',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noExecSync:
        'Use execFileSync instead of execSync to prevent shell injection. execSync passes commands through the shell, which is unsafe with user-controlled input.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Check for direct function calls: execSync(...)
      CallExpression(node) {
        // Direct call: execSync('...')
        if (node.callee.type === 'Identifier' && node.callee.name === 'execSync') {
          context.report({ node, messageId: 'noExecSync' })
          return
        }

        // Member expression: child_process.execSync('...')
        // or require('child_process').execSync('...')
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'execSync'
        ) {
          context.report({ node, messageId: 'noExecSync' })
        }
      },

      // Check for destructured imports: import { execSync } from 'child_process'
      ImportDeclaration(node) {
        if (node.source.value === 'child_process') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'execSync') {
              context.report({ node: specifier, messageId: 'noExecSync' })
            }
          }
        }
      },
    }
  },
}
export default rule
