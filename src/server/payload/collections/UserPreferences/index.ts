/**
 * UserPreferences Collection
 * Stores user-specific preferences including teacher persona selection
 *
 * @fileType collection-config
 * @domain auth
 * @pattern user-owned
 * @ai-summary User preferences collection with teacher persona relationship and row-level security
 */

import type { AccessArgs, CollectionConfig } from 'payload'
import type { User } from '@/payload-types'

import { adminOnly } from '../../access/adminOnly'
import { AccountRole } from '../Users/roles'
import { isUsersCollectionUser } from '../../access/isUsersCollectionUser'

/**
 * Access control: admin can do everything, users can read/update their own
 */
const userOrAdminAccess = ({ req: { user } }: AccessArgs<User>) => {
  if (!isUsersCollectionUser(user)) return false

  // Admins can access all records
  if (user.role === AccountRole.Admin) return true

  // Users can only access their own record
  return {
    user: { equals: user.id },
  }
}

export const UserPreferences: CollectionConfig = {
  slug: 'user-preferences',
  access: {
    create: adminOnly, // Only admins can create (or internal processes)
    read: userOrAdminAccess,
    update: userOrAdminAccess,
    delete: adminOnly, // Only admins can delete
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'teacherPersona', 'createdAt'],
    group: 'Users',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true, // 1:1 relationship
      hasMany: false,
      admin: {
        description: 'The user this preferences record belongs to',
      },
    },
    {
      name: 'teacherPersona',
      type: 'relationship',
      relationTo: 'prompts',
      required: false,
      hasMany: false,
      filterOptions: {
        type: { equals: 'persona' },
        status: { equals: 'published' },
      },
      admin: {
        description: 'The teacher persona this user prefers',
      },
    },
  ],
  timestamps: true,
}
