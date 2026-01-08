/**
 * Conversations Collection
 * Stores chat conversations between users and AI tutor for exercises
 *
 * Security:
 * - Users can only access their own conversations
 * - Admin can manage all conversations
 *
 * Relationships:
 * - user: The student who owns this conversation
 * - exercise: The exercise this conversation is about
 */
import type { CollectionConfig, Access } from 'payload'
import { authenticated } from '../access/authenticated'
import type { User } from '@/payload-types'
import { Role } from './Users/roles'

const isOwner: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (user.role === Role.Admin) return true

  return {
    user: {
      equals: user.id,
    },
  }
}

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'exercise', 'lastMessageAt', 'createdAt'],
    description: 'Chat conversations between users and AI tutor',
  },
  access: {
    create: authenticated,
    read: isOwner,
    update: isOwner,
    delete: isOwner,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Student who owns this conversation',
      },
    },
    {
      name: 'exercise',
      type: 'relationship',
      relationTo: 'exercises',
      required: true,
      index: true,
      admin: {
        description: 'Exercise this conversation is about',
      },
    },
    {
      name: 'messages',
      type: 'array',
      defaultValue: [],
      maxRows: 100, // Prevent unbounded growth
      admin: {
        description: 'Conversation message history',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'User', value: 'user' },
            { label: 'Assistant', value: 'model' },
          ],
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
          maxLength: 5000, // Prevent excessive message length
          admin: {
            description: 'Message content',
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
          },
        },
      ],
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'Timestamp of last message (auto-updated)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Auto-update lastMessageAt when messages are added
        if (data.messages && data.messages.length > 0) {
          const lastMessage = data.messages[data.messages.length - 1]
          data.lastMessageAt = lastMessage.timestamp || new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
