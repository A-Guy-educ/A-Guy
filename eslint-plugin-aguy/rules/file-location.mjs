/**
 * ESLint Rule: file-location
 *
 * Enforces that React components are located in the correct directory structure.
 * Components should be placed under src/ui/web/ or src/ui/admin/, not src/components/
 *
 * @version 1.0.0
 */

/**
 * Creates an ESLint rule that enforces proper file location for React components.
 *
 * Rule Logic:
 * - Files in src/components/ are deprecated and should be migrated to src/ui/web/ or src/ui/admin/
 * - New components should be created in src/ui/web/ or src/ui/admin/
 * - src/ui/shared/ is also deprecated for new components
 *
 * @returns {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    name: 'file-location',
    version: '1.0.0',
    type: 'problem',
    docs: {
      description: 'Enforce React components to be located in src/ui/web/ or src/ui/admin/',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/aguy/A-Guy/blob/main/docs/file-location-rule.md',
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: {
      type: 'object',
      properties: {
        allowList: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file patterns to allow in src/components/',
          default: [],
        },
        suggestMigration: {
          type: 'boolean',
          description: 'Suggest migration path in error message',
          default: true,
        },
      },
      additionalProperties: false,
    },
    messages: {
      deprecatedLocation:
        'React components should not be in src/components/. Migrate to {{destination}}.',
      deprecatedShared:
        'React components should not be in src/ui/shared/. Use src/ui/web/ or src/ui/admin/ instead.',
      suggestMigration: 'Consider migrating this file to {{destination}}',
    },
  },

  create(context) {
    const options = context.options[0] || {}
    const allowList = options.allowList || []
    const suggestMigration = options.suggestMigration !== false

    /**
     * Check if file path matches any allow list patterns
     * @param {string} filePath
     * @returns {boolean}
     */
    const isAllowed = (filePath) => {
      return allowList.some((pattern) => {
        if (pattern.endsWith('/')) {
          return filePath.startsWith(pattern) || filePath.includes(`${pattern}/`)
        }
        return filePath === pattern || filePath.includes(`/${pattern}/`)
      })
    }

    /**
     * Determine the correct destination for a file in src/components/
     * @param {string} filePath
     * @returns {string}
     */
    const getMigrationDestination = (filePath) => {
      const relativePath = filePath.replace(/^src\/components\//, '')
      const pathParts = relativePath.split('/')

      // Check if it's a ui component (in src/components/ui/)
      if (pathParts[0] === 'ui') {
        // src/components/ui/Foo -> src/ui/web/components/Foo
        return `src/ui/web/components/${pathParts.slice(1).join('/')}`
      }

      // Check if it's a courses component
      if (pathParts[0] === 'courses') {
        // src/components/courses/Foo -> src/ui/web/courses/Foo
        return `src/ui/web/courses/${pathParts.slice(1).join('/')}`
      }

      // Default: src/components/foo -> src/ui/web/foo
      return `src/ui/web/${relativePath}`
    }

    /**
     * Check if the source file contains React component
     * @param {string} sourceCode
     * @returns {boolean}
     */
    const isReactComponent = (sourceCode) => {
      // Check for common React component patterns
      const patterns = [
        /export\s+(default\s+)?(function|const)\s+\w+\s*=/, // export const Foo = () => {}
        /export\s+function\s+\w+/, // export function Foo() {}
        /export\s+default\s+class\s+\w+/, // export default class Foo {}
        /from\s+['"]react['"]/, // imports from react
        /from\s+['"]next\/image['"]/, // imports from next/image
        /from\s+['"]next\/link['"]/, // imports from next/link
        /'use\s+client'/, // 'use client' directive
        /'use\s+server'/, // 'use server' directive
      ]

      return patterns.some((pattern) => pattern.test(sourceCode))
    }

    return {
      Program(node) {
        const filePath = context.filename || context.getFilename()
        const sourceCode = context.getSourceCode()

        // Skip node_modules and non-src files
        if (/node_modules/.test(filePath)) {
          return
        }

        // Check for deprecated src/components/ location
        if (/src\/components\//.test(filePath)) {
          // Check if this file is in the allow list
          if (isAllowed(filePath)) {
            return
          }

          // Check if it's a React component
          if (isReactComponent(sourceCode.getText())) {
            const destination = getMigrationDestination(filePath)
            const suggest = suggestMigration
              ? [
                  {
                    desc: `Migrate to ${destination}`,
                    fix(fixer) {
                      // Calculate the relative path from project root
                      const projectRoot = filePath.substring(0, filePath.indexOf('src/'))
                      const _newPath = `${projectRoot}${destination}`
                      return fixer.replaceText(
                        node.range,
                        `// TODO: Migrate this file to ${destination}\n${sourceCode.getText()}`,
                      )
                    },
                  },
                ]
              : []

            context.report({
              node,
              messageId: 'deprecatedLocation',
              data: { destination },
              suggest,
            })
          }
        }

        // Check for deprecated src/ui/shared/ location
        if (/src\/ui\/shared\//.test(filePath)) {
          if (isReactComponent(sourceCode.getText())) {
            context.report({
              node,
              messageId: 'deprecatedShared',
            })
          }
        }
      },
    }
  },
}
export default rule
