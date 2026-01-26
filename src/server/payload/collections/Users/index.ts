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
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

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
        update: ({ req: { user } }) =>
          isUsersCollectionUser(user) && user.role === AccountRole.Admin,
      },
      hooks: {
        // Enforce role='student' on signup (ignore client input)
        beforeChange: [ensureRoleOnSignup],
      },
      admin: {
        position: 'sidebar',
      },
    },
    // OAuth fields
    {
      name: 'googleSub',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'verifiedEmail',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'registrationMethod',
      type: 'select',
      options: [
        { label: 'Google', value: 'google' },
        { label: 'Email', value: 'email' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'registeredAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'googleProfile',
      type: 'group',
      fields: [{ name: 'name', type: 'text' }],
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'oauthLoginSecretEnc',
      type: 'text',
      // Encrypted secret for payload.login() - required for OAuth users
      // Server-side reads allowed via overrideAccess in callback
      access: {
        read: () => false, // Never exposed to client
        create: () => true, // Set during OAuth user creation
        update: () => false, // Never updatable after creation
      },
      admin: {
        hidden: true,
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
