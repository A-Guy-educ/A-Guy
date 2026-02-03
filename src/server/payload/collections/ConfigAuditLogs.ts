/**
 * ConfigAuditLogs Collection
 *
 * @fileType collection-config
 * @domain config
 * @pattern audit-log
 * @ai-summary Append-only audit log for config mutations
 *
 * Security:
 * - create: DISABLED for UI (hooks use overrideAccess)
 * - read: admin only
 * - update: DISABLED (append-only)
 * - delete: DISABLED (append-only)
 *
 * Privacy:
 * - Secrets: Never store plaintext before/after values
 * - Variables: Store metadata only (no sensitive data)
 */

import type { CollectionConfig } from 'payload'

import { ConfigKind } from '@/infra/config/config-constants'
import { configAdminOnly } from '../access/configAdminOnly'

export const ConfigAuditLogs: CollectionConfig = {
  slug: 'config_audit_logs',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'tenant', 'kind', 'action', 'actor', 'createdAt'],
    group: 'System',
    description: 'Append-only audit log for config mutations. Secrets never stored in plaintext.',
  },
  access: {
    create: () => false, // Only created via hooks with overrideAccess
    read: configAdminOnly,
    update: () => false, // Append-only
    delete: () => false, // Append-only
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Configuration key that was modified',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Tenant of the mutated config entry',
      },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Variable', value: ConfigKind.Variable },
        { label: 'Secret', value: ConfigKind.Secret },
        { label: 'System Param', value: ConfigKind.SystemParam },
      ],
      admin: {
        description: 'Type of config entry',
      },
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Updated', value: 'updated' },
        { label: 'Enabled', value: 'enabled' },
        { label: 'Disabled', value: 'disabled' },
      ],
      admin: {
        description: 'Action performed',
      },
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Admin user who performed the action',
      },
    },
    {
      name: 'reason',
      type: 'text',
      required: false,
      admin: {
        description: 'Optional reason for the change',
      },
    },
  ],
  timestamps: true,
}
