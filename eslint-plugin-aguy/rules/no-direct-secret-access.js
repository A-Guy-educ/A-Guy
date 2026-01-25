/**
 * ESLint Rule: no-direct-secret-access
 *
 * Prevents direct access to secrets via process.env.
 * Enforces use of:
 * - getConfigValue(key) for bootstrap config (non-secret env vars)
 * - getSecret(tenantId, key) for tenant-scoped secrets
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
 *
 * // ✅ GOOD - Bootstrap config value (non-secret)
 * import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
 * const tenantSlug = getConfigValue('DEFAULT_TENANT_SLUG')
 */

// List of keys that are allowed to be accessed directly (bootstrap config + test convenience)
// Not allowed to be changed
const UNRESTRICTED_SECRET_KEYS = [
  'ATLAS_VECTOR_TESTS', // Test flag for vector search tests
  'BLOB_READ_WRITE_TOKEN', // Vercel Blob plugin initialization (startup)
  'CONFIG_MASTER_KEY',
  'CRON_SECRET', // Jobs access control
  'DATABASE_URL',
  'DATABASE_URL_ATLAS',
  'NEXT_PUBLIC_SERVER_URL',
  'PAYLOAD_SECRET',
]

// Pattern to match process.env.X access (prefixed with _ to indicate intentionally unused)
const _PROCESS_ENV_PATTERN = /process\.env\.([A-Z_][A-Z0-9_]*)/g

const noDirectSecretAccess = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent direct secret access via process.env. Use getConfigValue(key) or getSecret(tenantId, key) instead.',
      category: 'Security',
      recommended: true,
    },
    messages: {
      directSecretAccess:
        'Direct access to "{{secretKey}}" via process.env is not allowed. ' +
        'For bootstrap config (non-secret): Use getConfigValue("{{secretKey}}") from "@/lib/config/runtime/bootstrap-config". ' +
        'For secrets: Use getSecret(tenantId, "{{secretKey}}") from "@/lib/config/runtime".',
    },
  },

  create(context) {
    return {
      // Check MemberExpression for process.env.X access
      // Literal property: process.env.SECRET_KEY - flagged unless in UNRESTRICTED_SECRET_KEYS
      // Computed property: process.env[key] - always allowed (used by getConfigValue)
      MemberExpression(node) {
        // Check if this is process.env pattern
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'process' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          // Skip computed access like process.env[key] - allowed for getConfigValue
          if (node.computed) {
            return
          }

          // Only flag literal access like process.env.SECRET_KEY
          if (node.property.type === 'Identifier') {
            const accessedKey = node.property.name

            // Framework bootstrap keys are allowed in framework code
            // All other code should use getConfigValue(key)
            if (!UNRESTRICTED_SECRET_KEYS.includes(accessedKey)) {
              context.report({
                node: node,
                messageId: 'directSecretAccess',
                data: {
                  secretKey: accessedKey,
                },
              })
            }
          }
        }
      },
    }
  },
}

export default noDirectSecretAccess
