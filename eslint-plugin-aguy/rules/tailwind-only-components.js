/**
 * ESLint Rule: tailwind-only-components
 *
 * Ensures frontend components use only Tailwind CSS (no SCSS imports).
 *
 * @example
 * // ❌ BAD - SCSS import
 * import './MyComponent.module.scss'
 *
 * // ✅ GOOD - Tailwind only
 * className="bg-primary text-white"
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce Tailwind-only styling in components (no SCSS)',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      scssImport: 'SCSS imports are not allowed in components. Use Tailwind CSS utilities instead.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()

    // Only check component files (in src/components or src/app)
    if (!filename.includes('/components/') && !filename.includes('/app/')) {
      return {}
    }

    // Skip admin components (they can use SCSS)
    if (filename.includes('/components/admin/')) {
      return {}
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value

        // Check for SCSS or CSS module imports
        if (
          importPath.endsWith('.scss') ||
          importPath.endsWith('.module.scss') ||
          importPath.endsWith('.css') ||
          importPath.endsWith('.module.css')
        ) {
          context.report({
            node,
            messageId: 'scssImport',
          })
        }
      },
    }
  },
}
