/**
 * MemoryItems Collection
 * Stores long-term memory items per user for AI chat context
 * Uses vector embeddings for semantic retrieval via MongoDB Atlas Vector Search
 *
 * @fileType collection-config
 * @domain chat
 * @pattern user-owned, vector-search
 * @ai-summary Memory items collection with vector embeddings for semantic retrieval and user isolation
 *
 * Security (CRITICAL):
 * - Users can only read their own memory items
 * - Creation/Update/Delete restricted to admin (server-side only)
 * - Vector search MUST filter by userId for tenant isolation
 *
 * Vector Search:
 * - Requires MongoDB Atlas with vector search index
 * - Index name: memory_items_embedding_v1
 * - Dimensions: 1536 (text-embedding-3-small)
 * - Similarity: cosine
 */
import type { User } from '@/payload-types'
import type { Access, CollectionConfig } from 'payload'
import { AccountRole } from './Users/roles'

const isAdmin: Access = ({ req }) => {
  const user = req.user as User | null
  return user?.role === AccountRole.Admin
}

const readOwnMemories: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (user.role === AccountRole.Admin) return true

  // Users can only read their own memory items
  return {
    userId: { equals: user.id },
  }
}

export const MemoryItems: CollectionConfig = {
  slug: 'memory_items',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['text', 'type', 'importance', 'status', 'createdAt'],
    group: 'Chat System',
    description: 'Long-term memory items for AI chat context',
  },
  access: {
    read: readOwnMemories,
    create: isAdmin, // Server-side only
    update: isAdmin, // Server-side only
    delete: isAdmin, // Server-side only
  },
  fields: [
    // ========================================
    // Tenant Isolation (CRITICAL)
    // ========================================
    {
      name: 'userId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'User ID for filtering (scalar field, NOT a relationship)',
        readOnly: true,
      },
    },
    {
      name: 'conversationId',
      type: 'text',
      index: true,
      admin: {
        description: 'Optional conversation scope (scalar field, NOT a relationship)',
        readOnly: true,
      },
    },

    // ========================================
    // Core Fields
    // ========================================
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Preference', value: 'preference' },
        { label: 'Decision', value: 'decision' },
        { label: 'Fact', value: 'fact' },
        { label: 'Open Loop', value: 'open_loop' },
        { label: 'Profile', value: 'profile' },
        { label: 'Constraint', value: 'constraint' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Category of memory item',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      maxLength: 2000,
      admin: {
        description: 'The memory content (max 2000 chars)',
      },
    },
    {
      name: 'embedding',
      type: 'json',
      required: true,
      admin: {
        description: 'Vector embedding (1536 dimensions) - auto-generated',
        readOnly: true,
      },
      validate: (value) => {
        if (!Array.isArray(value)) {
          return 'Embedding must be an array'
        }
        if (value.length !== 1536) {
          return `Embedding must have exactly 1536 dimensions, got ${value.length}`
        }
        if (!value.every((v) => typeof v === 'number')) {
          return 'Embedding must contain only numbers'
        }
        return true
      },
    },
    {
      name: 'importance',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: 'Importance scale 1-5 (higher = more important)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Deprecated', value: 'deprecated' },
      ],
      index: true,
      admin: {
        description: 'Status (use deprecated instead of deleting)',
      },
    },

    // ========================================
    // Source Tracking
    // ========================================
    {
      name: 'source',
      type: 'group',
      admin: {
        description: 'Metadata about where this memory came from',
      },
      fields: [
        {
          name: 'sourceConversationId',
          type: 'text',
          admin: {
            description: 'Conversation where this memory was extracted',
          },
        },
        {
          name: 'sourceMessageTimestamp',
          type: 'date',
          required: true,
          admin: {
            description: 'Timestamp of source message',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'sourceMessageRole',
          type: 'select',
          required: true,
          options: [
            { label: 'User', value: 'user' },
            { label: 'Assistant', value: 'assistant' },
          ],
          admin: {
            description: 'Who said the message this memory came from',
          },
        },
      ],
    },

    // ========================================
    // Optional Admin Convenience
    // ========================================
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Convenience field for admin UI - DO NOT use for filtering',
        position: 'sidebar',
      },
    },
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations',
      admin: {
        description: 'Convenience field for admin UI - DO NOT use for filtering',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
