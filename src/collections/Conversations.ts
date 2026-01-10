/**
 * Conversations Collection
 * Stores chat conversations between users and AI tutor for exercises
 *
 * @fileType collection-config
 * @domain chat
 * @pattern user-owned
 * @ai-summary Conversations collection with user ownership, message history, and context management
 *
 * Security:
 * - Users can only access their own conversations
 * - Admin can manage all conversations
 *
 * Relationships:
 * - user: The student who owns this conversation
 * - exercise: The exercise this conversation is about
 */
import type { User } from '@/payload-types'
import type { Access, CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { AccountRole } from './Users/roles'

const isOwner: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (user.role === AccountRole.Admin) return true

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
            { label: 'Assistant', value: 'assistant' },
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
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'Compressed history of older messages',
      },
      defaultValue: '',
    },
    {
      name: 'summaryUpdatedAt',
      type: 'date',
      admin: {
        description: 'When summary was last updated',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'summaryUntilTimestamp',
      type: 'date',
      admin: {
        description: 'Summary includes messages up to this timestamp',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'contextPolicyVersion',
      type: 'text',
      defaultValue: 'v1',
      required: true,
      admin: {
        description: 'Version of prompt composition policy',
      },
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
