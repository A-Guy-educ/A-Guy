/**
 * Code Redemptions Collection
 *
 * @fileType collection-config
 * @domain courses
 * @pattern access-code-gate
 * @ai-summary Collection for tracking access code redemptions (audit trail)
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { authenticated } from '@/server/payload/access/authenticated'
import { authenticatedOrOwner } from '@/server/payload/access/authenticatedOrOwner'
import { tenantField } from '@/server/payload/fields/tenant'

export const CodeRedemptions: CollectionConfig = {
  slug: 'code-redemptions',
  admin: {
    useAsTitle: 'redeemedAt',
    defaultColumns: ['code', 'user', 'lessonId', 'redeemedAt'],
  },
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    // The access code that was redeemed
    {
      name: 'code',
      type: 'relationship',
      relationTo: 'access-codes',
      required: true,
      index: true,
      admin: {
        description: 'The access code that was redeemed',
      },
    },
    // The user who redeemed the code
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user who redeemed the code',
      },
    },
    // The lesson ID that was unlocked
    {
      name: 'lessonId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'The lesson ID that was unlocked',
      },
    },
    // When the code was redeemed
    {
      name: 'redeemedAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Timestamp of redemption',
      },
    },
    // Tenant
    tenantField,
  ],
  timestamps: false, // We manage redeemedAt manually
}
