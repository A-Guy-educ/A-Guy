/**
 * Conversations Collection
 * Stores chat conversations between users and AI tutor with context scoping
 *
 * @fileType collection-config
 * @domain chat
 * @pattern user-owned, context-scoped
 * @ai-summary Context-scoped conversations with polymorphic context references
 *
 * Security:
 * - Users can only access their own conversations
 * - Admin can manage all conversations
 * - Context access validation via validateContextAccess service
 *
 * Relationships:
 * - user: The student who owns this conversation
 * - contextRef: Polymorphic reference to Course/Chapter/Lesson/Exercise
 * - contextKey: Derived operational key for indexing (e.g., "exercises:abc123")
 *
 * Archival:
 * - Use ONLY archivedAt field for archival (no status field)
 * - Active conversation: archivedAt === null
 * - Archived conversation: archivedAt !== null
 * - MongoDB partial unique index enforces one active conversation per user+context
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
    defaultColumns: ['user', 'contextKey', 'lastMessageAt', 'createdAt'],
    description: 'Context-scoped chat conversations with AI tutor',
  },
  access: {
    create: authenticated,
    read: isOwner,
    update: isOwner,
    delete: isOwner,
  },
  dbName: 'conversations',
  fields: [
    // ========================================
    // User Ownership
    // ========================================
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

    // ========================================
    // Context Reference (Polymorphic)
    // ========================================
    {
      name: 'contextRef',
      type: 'relationship',
      relationTo: ['courses', 'chapters', 'lessons', 'exercises'],
      required: true,
      index: true,
      admin: {
        description: 'Polymorphic context reference (Course/Chapter/Lesson/Exercise)',
      },
    },

    // ========================================
    // Context Key (Derived Operational Key)
    // Populated by beforeChange hook from contextRef
    // ========================================
    {
      name: 'contextKey',
      type: 'text',
      required: false, // Populated by hook, not required in input
      index: true,
      admin: {
        hidden: true,
        description: 'Derived key for indexing (e.g., "exercises:abc123")',
      },
    },

    // ========================================
    // Legacy Exercise Field (Deprecated)
    // Kept for migration compatibility only
    // ========================================
    {
      name: 'exercise',
      type: 'relationship',
      relationTo: 'exercises',
      required: false,
      index: true,
      admin: {
        description: 'Legacy field - use contextRef instead. Will be removed in future version.',
      },
    },

    // ========================================
    // Messages
    // ========================================
    {
      name: 'messages',
      type: 'array',
      defaultValue: [],
      maxRows: 100,
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
          maxLength: 5000,
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

    // ========================================
    // Summary (Compressed History)
    // ========================================
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

    // ========================================
    // Context Policy Version
    // ========================================
    {
      name: 'contextPolicyVersion',
      type: 'text',
      defaultValue: 'v1',
      required: true,
      admin: {
        description: 'Version of prompt composition policy',
      },
    },

    // ========================================
    // Last Message Timestamp
    // ========================================
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

    // ========================================
    // Archival (Single Source of Truth)
    // ========================================
    {
      name: 'archivedAt',
      type: 'date',
      index: true,
      admin: {
        description: 'Archival timestamp. Active conversation: null. Archived: non-null.',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req: _req, operation }) => {
        // Derive contextKey from raw contextRef shape
        // contextRef.value is ALWAYS a string ID on writes (never populated object)
        if (operation === 'create' || operation === 'update') {
          if (data.contextRef?.value && data.contextRef?.relationTo) {
            const collectionSlug = data.contextRef.relationTo
            const contextId = data.contextRef.value
            data.contextKey = `${collectionSlug}:${contextId}`
          }

          // Auto-update lastMessageAt when messages are added
          if (data.messages && data.messages.length > 0) {
            const lastMessage = data.messages[data.messages.length - 1]
            data.lastMessageAt = lastMessage.timestamp || new Date().toISOString()
          }
        }
        return data
      },
    ],
  },
  timestamps: true,
}
