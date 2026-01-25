/**
 * ESLint Plugin for A-Guy Platform Patterns
 *
 * Enforces code patterns and best practices specific to the A-Guy platform.
 *
 * Usage in eslint.config.mjs:
 * import aguyPlugin from './eslint-plugin-aguy/index.js'
 *
 * export default [
 *   {
 *     plugins: { aguy: aguyPlugin },
 *     rules: {
 *       'aguy/require-collection-access': 'error',
 *       'aguy/no-nested-metadata': 'error',
 *       'aguy/tailwind-only-components': 'warn',
 *       'aguy/no-direct-secret-access': 'error',
 *     }
 *   }
 * ]
 */

import noDirectSecretAccess from './rules/no-direct-secret-access.js'
import noNestedMetadata from './rules/no-nested-metadata.js'
import requireAuthEndpoints from './rules/require-auth-endpoints.js'
import requireCollectionAccess from './rules/require-collection-access.js'
import tailwindOnlyComponents from './rules/tailwind-only-components.js'

export default {
  meta: {
    name: 'eslint-plugin-aguy',
    version: '1.0.0',
  },
  rules: {
    'require-collection-access': requireCollectionAccess,
    'no-nested-metadata': noNestedMetadata,
    'tailwind-only-components': tailwindOnlyComponents,
    'require-auth-endpoints': requireAuthEndpoints,
    'no-direct-secret-access': noDirectSecretAccess,
  },
}
