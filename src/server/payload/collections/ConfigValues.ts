/**
 * ConfigValues Collection
 *
 * @fileType collection-config
 * @domain config
 * @pattern domain-scoped-config, json-storage
 * @ai-summary Domain-based configuration values stored as JSON, tenant-scoped
 *
 * Security:
 * - Admin-only access for all operations
 * - Tenant-scoped: each entry belongs to exactly one tenant
 * - Domain-based grouping for organized configuration management
 */

import type { CollectionConfig } from 'payload'

import { CONFIG_DOMAINS } from '@/infra/config/config-constants'
import { configAdminOnly } from '../access/configAdminOnly'
import { beforeChangeValidateConfigValues } from '../hooks/configValues/beforeChange-hook'

export const ConfigValues: CollectionConfig = {
  slug: 'config_values',
  admin: {
    useAsTitle: 'domain',
    defaultColumns: ['domain', 'tenant', 'updatedAt'],
    group: 'System',
    description:
      'Tenant-scoped configuration values stored as JSON. Organized by feature domain (chat, pdf_conversion, global).',
  },
  access: {
    create: configAdminOnly,
    read: configAdminOnly,
    update: configAdminOnly,
    delete: configAdminOnly,
  },
  fields: [
    {
      name: 'domain',
      type: 'select',
      required: true,
      options: CONFIG_DOMAINS.map((d) => ({ label: d, value: d })),
      index: true,
      admin: {
        description: 'Feature domain for this configuration',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        description: 'Tenant this configuration belongs to',
        position: 'sidebar',
      },
    },
    {
      name: 'config',
      type: 'json',
      required: true,
      admin: {
        description: 'Configuration values as JSON object',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Optional description of this configuration',
      },
    },
  ],
  hooks: {
    /**
     * beforeChange: Validate config values, check for secret-like keys
     * CRITICAL: Pass req to nested operations for transaction safety
     */
    beforeChange: [beforeChangeValidateConfigValues],
  },
  timestamps: true,
}
