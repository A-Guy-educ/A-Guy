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
 *     }
 *   }
 * ]
 */

const requireCollectionAccess = require('./rules/require-collection-access.js')
const noNestedMetadata = require('./rules/no-nested-metadata.js')
const tailwindOnlyComponents = require('./rules/tailwind-only-components.js')
const requireAuthEndpoints = require('./rules/require-auth-endpoints.js')

module.exports = {
  meta: {
    name: 'eslint-plugin-aguy',
    version: '1.0.0'
  },
  rules: {
    'require-collection-access': requireCollectionAccess,
    'no-nested-metadata': noNestedMetadata,
    'tailwind-only-components': tailwindOnlyComponents,
    'require-auth-endpoints': requireAuthEndpoints
  }
}
