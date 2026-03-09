/**
 * ConfigSecrets Collection
 *
 * @fileType collection-config
 * @domain config
 * @pattern key-value-store, encrypted-values
 * @ai-summary Tenant-scoped encrypted secrets. All values are always encrypted.
 *
 * Security (CRITICAL):
 * - Admin-only access for all operations
 * - All values encrypted at rest in database
 * - Admin UI never shows decrypted values after save (write-only)
 * - Audit log tracks all mutations without leaking secrets
 */

import type { CollectionConfig } from 'payload'

import { isSnakeCase } from '@/infra/config/config-constants'
import { configAdminOnly } from '../access/configAdminOnly'
import { afterChangeAuditLog } from '../hooks/configSecrets/afterChange-hook'
import { afterReadHideSecretValue } from '../hooks/configSecrets/afterRead-hook'
import { beforeChangeEncryptAndValidate } from '../hooks/configSecrets/beforeChange-hook'

export const ConfigSecrets: CollectionConfig = {
  slug: 'config_secrets',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'title', 'tenant', 'enabled', 'updatedAt'],
    group: 'System',
    description: 'Tenant-scoped encrypted secrets. All values are always encrypted.',
  },
  access: {
    create: configAdminOnly,
    read: configAdminOnly,
    update: configAdminOnly,
    delete: configAdminOnly,
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      // unique: true removed - uniqueness is now (tenant, key) enforced in hook
      index: true,
      admin: {
        description: 'Configuration key (snake_case, immutable after creation)',
      },
      validate: (value: unknown) => {
        if (!value || typeof value !== 'string') {
          return 'Key is required'
        }
        if (!isSnakeCase(value)) {
          return 'Key must be snake_case or SCREAMING_SNAKE_CASE (e.g., my_config_key or MY_CONFIG_KEY)'
        }
        return true
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        description: 'Tenant this secret belongs to',
        position: 'sidebar',
      },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Optional title/description for this secret',
      },
    },
    {
      name: 'value',
      type: 'text',
      // Not using `required: true` because partial updates (e.g. toggling enabled)
      // would fail field validation before the collection beforeChange hook can
      // preserve the existing encrypted value. Instead, validate on create only.
      validate: (value: unknown, { operation }: { operation?: string }) => {
        if (operation === 'create' && (!value || typeof value !== 'string')) {
          return 'Value is required'
        }
        return true
      },
      admin: {
        description: 'Secret value (write-only after save)',
      },
      hooks: {
        /**
         * afterRead: Clear value to implement write-only UX
         */
        afterRead: [afterReadHideSecretValue],
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: {
        description: 'Enable or disable this secret',
      },
    },
  ],
  hooks: {
    /**
     * beforeChange: Encrypt values, validate key immutability
     * CRITICAL: Pass req to nested operations for transaction safety
     */
    beforeChange: [beforeChangeEncryptAndValidate],
    /**
     * afterChange: Create audit log entry
     * CRITICAL: Use context to prevent infinite hook loops
     */
    afterChange: [afterChangeAuditLog],
  },
  timestamps: true,
}
