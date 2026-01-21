import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const MCPAuditLogs: CollectionConfig = {
  slug: 'mcp-audit-logs',
  admin: {
    useAsTitle: 'requestId',
    defaultColumns: ['requestId', 'toolName', 'adminUserId', 'tenantId', 'timestamp', 'success'],
  },
  access: {
    create: () => false,
    read: adminOnly,
    update: () => false,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'adminUserId',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Admin user who initiated the tool call',
      },
    },
    {
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        description: 'Tenant scope for the tool call',
      },
    },
    {
      name: 'toolName',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'MCP tool name that was executed',
      },
    },
    {
      name: 'args',
      type: 'json',
      admin: {
        description: 'Sanitized arguments passed to the tool',
      },
    },
    {
      name: 'resultCount',
      type: 'number',
      admin: {
        description: 'Number of records returned by the tool',
      },
    },
    {
      name: 'success',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        description: 'Whether the tool call succeeded',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the tool call occurred',
      },
    },
    {
      name: 'requestId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Request correlation ID',
      },
    },
    {
      name: 'durationMs',
      type: 'number',
      admin: {
        description: 'Tool execution duration in milliseconds',
      },
    },
  ],
  timestamps: false,
}
