/**
 * ESLint Plugin for A-Guy Platform Patterns
 *
 * Enforces code patterns and best practices specific to the A-Guy platform.
 *
 * Usage in eslint.config.mjs:
 * import aguyPlugin from './eslint-plugin-aguy/index.mjs'
 *
 * export default [
 *   {
 *     plugins: { aguy: aguyPlugin },
 *     rules: {
 *       'aguy/require-collection-access': 'error',
 *       'aguy/no-nested-metadata': 'error',
 *       'aguy/tailwind-only-components': 'warn',
 *     }
 *   }
 * ]
 */

import requireCollectionAccess from './rules/require-collection-access.mjs'
import noNestedMetadata from './rules/no-nested-metadata.mjs'
import tailwindOnlyComponents from './rules/tailwind-only-components.mjs'
import requireAuthEndpoints from './rules/require-auth-endpoints.mjs'
import fileLocation from './rules/file-location.mjs'
import noExecSync from './rules/no-exec-sync.mjs'

const plugin = {
  meta: {
    name: 'eslint-plugin-aguy',
    version: '1.0.0',
  },
  rules: {
    'require-collection-access': requireCollectionAccess,
    'no-nested-metadata': noNestedMetadata,
    'tailwind-only-components': tailwindOnlyComponents,
    'require-auth-endpoints': requireAuthEndpoints,
    'file-location': fileLocation,
    'no-exec-sync': noExecSync,
  },
}
export default plugin
