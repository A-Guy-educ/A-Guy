import type { Field } from 'payload'

export const createdByField: Field = {
  name: 'createdBy',
  type: 'relationship',
  relationTo: 'users',
  access: {
    // Read-only - cannot be manually changed
    update: () => false,
  },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'User who created this document',
  },
  hooks: {
    beforeChange: [
      ({ req, value, operation }) => {
        // Only set createdBy on create operations
        if (operation === 'create' && req.user) {
          return req.user.id
        }
        // Preserve existing value on update
        return value
      },
    ],
  },
}
