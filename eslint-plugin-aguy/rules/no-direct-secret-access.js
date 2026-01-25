/**
 * ESLint Rule: no-direct-secret-access
 *
 * Prevents direct access to secrets via process.env.
 * Enforces use of tenant-scoped getSecret() from '@/lib/config/runtime'
 *
 * Only the following keys are allowed to be accessed directly:
 * - CONFIG_MASTER_KEY, DATABASE_URL, DATABASE_URL_ATLAS, MCP_ENABLED, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL (bootstrap config)
 *
 * All other process.env access should use getSecret(tenantId, key)
 *
 * @example
 * // ❌ BAD - Direct secret access
 * const apiKey = process.env.OPENAI_API_KEY
 *
 * // ✅ GOOD - Tenant-scoped secret access
 * import { getSecret } from '@/lib/config/runtime'
 * import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
 * const tenantId = await getDefaultTenantId(payload)
 * const apiKey = getSecret(tenantId, 'OPENAI_API_KEY', { throwIfNotFound: false })
 */

// List of keys that are allowed to be accessed directly (bootstrap config)
const UNRESTRICTED_SECRET_KEYS = [
  'CONFIG_MASTER_KEY',
  'DATABASE_URL',
  'DATABASE_URL_ATLAS',
  'MCP_ENABLED',
  'PAYLOAD_SECRET',
  'NEXT_PUBLIC_SERVER_URL',
]

// Pattern to match process.env.X access
const PROCESS_ENV_PATTERN = /process\.env\.([A-Z_][A-Z0-9_]*)/g

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent direct secret access via process.env. Use getSecret(tenantId, key) instead.',
      category: 'Security',
      recommended: true,
    },
    messages: {
      directSecretAccess:
        'Direct access to secret "{{secretKey}}" via process.env is not allowed. ' +
        'Use getSecret(tenantId, "{{secretKey}}") from "@/lib/config/runtime" instead. ' +
        'Example: import { getSecret } from "@/lib/config/runtime"; ' +
        'const tenantId = await getDefaultTenantId(payload); ' +
        'const secret = getSecret(tenantId, "{{secretKey}}")',
    },
    schema: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
      description:
        'Additional keys that are allowed to be accessed directly (merged with default list)',
    },
  },

  create(context) {
    // Get additional unrestricted keys from options
    const options = context.options[0] || []
    const unrestrictedKeys = [...UNRESTRICTED_SECRET_KEYS, ...options]

    return {
      // Check MemberExpression for process.env.X access
      MemberExpression(node) {
        // Check if this is process.env.X pattern
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'process' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          // Check if the property is NOT in the unrestricted list
          const accessedKey = node.property.name

          if (!unrestrictedKeys.includes(accessedKey)) {
            context.report({
              node: node,
              messageId: 'directSecretAccess',
              data: {
                secretKey: accessedKey,
              },
            })
          }
        }
      },
    }
  },
}
