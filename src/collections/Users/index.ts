/**
 * Users Collection
 *
 * @fileType collection-config
 * @domain auth
 * @pattern rbac, user-owned
 * @ai-summary Users collection with authentication, RBAC roles, and audit hooks
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { adminOrSelf } from '../../access/adminOrSelf'
import { anyone } from '../../access/anyone'
import { ensureRoleOnSignup } from './hooks/ensureRoleOnSignup-hook'
import { preventLastAdminDemotion } from './hooks/preventLastAdminDemotion-hook'
import { auditRoleChange } from './hooks/auditRoleChange-hook'
import { AccountRole, ACCOUNT_ROLE_LABEL } from './roles'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: adminOnly, // Only admins can access the admin panel
    create: anyone, // Allow public signup - users can create their own accounts
    delete: adminOnly, // Only admins can delete users
    read: adminOrSelf, // Admins can read all, users can read their own
    update: adminOrSelf, // Admins can update all, users can update their own
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: {
    cookies: {
      secure: true,
      sameSite: 'None',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      options: Object.entries(ACCOUNT_ROLE_LABEL).map(([value, label]) => ({
        label,
        value,
      })),
      defaultValue: AccountRole.Student,
      required: true,
      saveToJWT: true, // Include in JWT for fast access checks
      access: {
        // Only admins can update the role field
        update: ({ req: { user } }) => user?.role === AccountRole.Admin,
      },
      hooks: {
        // Enforce role='student' on signup (ignore client input)
        beforeChange: [ensureRoleOnSignup],
      },
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    // Prevent demoting the last admin
    beforeChange: [preventLastAdminDemotion],
    // Audit trail for role changes
    afterChange: [auditRoleChange],
  },
  timestamps: true,
}
