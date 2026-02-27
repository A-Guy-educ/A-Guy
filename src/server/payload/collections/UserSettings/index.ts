/**
 * UserSettings Collection
 *
 * @fileType collection-config
 * @domain user
 * @pattern user-settings
 * @ai-summary Collection for storing per-user settings including teacher profile selection
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { authenticatedOrOwner } from '../../access/authenticatedOrOwner'

export const UserSettings: CollectionConfig = {
  slug: 'user_settings',
  access: {
    create: adminOnly,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'teacherProfile', 'createdAt'],
    group: 'Users',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'The user this settings record belongs to',
        readOnly: true,
      },
    },
    {
      name: 'teacherProfile',
      type: 'relationship',
      relationTo: 'teacher_profiles',
      required: false,
      admin: {
        description: 'Selected teacher profile - leave empty to use default',
      },
    },
  ],
  timestamps: true,
}
