/**
 * ConfigAuditLogs Collection
 *
 * @fileType collection-config
 * @domain config
 * @pattern audit-log
 * @ai-summary Append-only audit log for config secret mutations
 *
 * Security:
 * - create: DISABLED for UI (hooks use overrideAccess)
 * - read: admin only
 * - update: DISABLED (append-only)
 * - delete: DISABLED (append-only)
 *
 * Privacy:
 * - Secrets: Never store plaintext before/after values
 */

import type { CollectionConfig } from 'payload'

import { configAdminOnly } from '../access/configAdminOnly'

export const ConfigAuditLogs: CollectionConfig = {
  slug: 'config_audit_logs',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'tenant', 'action', 'actor', 'createdAt'],
    group: 'System',
    description:
      'Append-only audit log for config secret mutations. Secrets never stored in plaintext.',
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
