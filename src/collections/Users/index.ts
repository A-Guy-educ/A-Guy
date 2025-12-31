import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    // Allow public signup - users can create their own accounts
    create: anyone,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
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
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Student', value: 'student' },
      ],
      defaultValue: ['student'],
      required: true,
      saveToJWT: true, // Include in JWT for fast access checks
      access: {
        // Only admins can modify roles - prevents privilege escalation
        update: ({ req: { user } }) => {
          if (!user) return false
          const roles = user.roles as string[] | undefined
          return roles?.includes('admin') ?? false
        },
      },
    },
  ],
  timestamps: true,
}
