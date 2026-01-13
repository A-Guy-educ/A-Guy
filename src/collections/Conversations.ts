/**
 * Conversations Collection
 * Stores chat conversations between users and AI tutor for exercises and lessons
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
 * - exercise: The exercise this conversation is about (optional, for exercise-specific chats)
 * - lesson: The lesson this conversation is about (optional, for lesson-specific chats)
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
    defaultColumns: ['user', 'exercise', 'lesson', 'lastMessageAt', 'createdAt'],
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
      required: false,
      index: true,
      admin: {
        description: 'Exercise this conversation is about (for exercise-specific chats)',
        condition: (data) => !data.lesson, // Only show if lesson is not set
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: false,
      index: true,
      admin: {
        description: 'Lesson this conversation is about (for lesson-specific chats)',
        condition: (data) => !data.exercise, // Only show if exercise is not set
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
    beforeValidate: [
      async ({ data }) => {
        // Ensure either exercise or lesson is provided, but not both
        if (!data) return data
        if (!data.exercise && !data.lesson) {
          throw new Error('Either exercise or lesson must be provided')
        }
        if (data.exercise && data.lesson) {
          throw new Error('Cannot have both exercise and lesson')
        }
        return data
      },
    ],
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
