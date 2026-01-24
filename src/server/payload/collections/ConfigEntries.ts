/**
 * ConfigEntries Collection
 *
 * @fileType collection-config
 * @domain config
 * @pattern key-value-store, encrypted-values
 * @ai-summary Config entries with encryption for secrets, audit logging, and write-only UX for secrets
 *
 * Security (CRITICAL):
 * - Admin-only access for all operations
 * - Secrets encrypted at rest in database
 * - Admin UI never shows decrypted secrets after save (write-only)
 * - Audit log tracks all mutations without leaking secrets
 */

import type { CollectionConfig } from 'payload'

import { ConfigKind, isSnakeCase } from '@/lib/config/config-constants'
import { configAdminOnly } from '../access/configAdminOnly'
import { afterChangeAuditLog } from '../hooks/configEntries/afterChange-hook'
import { afterReadHideSecretValue } from '../hooks/configEntries/afterRead-hook'
import { beforeChangeEncryptAndValidate } from '../hooks/configEntries/beforeChange-hook'

export const ConfigEntries: CollectionConfig = {
  slug: 'config_entries',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'kind', 'enabled', 'updatedAt'],
    group: 'System',
    description:
      'Global configuration key/value store. Variables are plaintext, secrets are encrypted.',
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
      unique: true,
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
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Variable', value: ConfigKind.Variable },
        { label: 'Secret', value: ConfigKind.Secret },
      ],
      defaultValue: ConfigKind.Variable,
      admin: {
        description: 'Variable: stored as plaintext. Secret: encrypted at rest.',
        position: 'sidebar',
      },
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      admin: {
        description: 'Configuration value. Secrets are write-only after save.',
      },
      hooks: {
        /**
         * afterRead: Clear secret value to implement write-only UX
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
        description: 'Enable or disable this configuration entry',
      },
    },
  ],
  hooks: {
    /**
     * beforeChange: Encrypt secrets, validate key/kind immutability
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
