/**
 * UserStats Collection
 *
 * Stores per-user statistics including time spent, streak, and activity log
 *
 * @fileType collection-config
 * @domain progress-tracking
 * @pattern user-owned, progress-tracking
 * @ai-summary User statistics tracking for time spent, daily streak, and activity history
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { authenticated } from '@/server/payload/access/authenticated'
import { authenticatedOrOwner } from '@/server/payload/access/authenticatedOrOwner'
import { tenantField } from '@/server/payload/fields/tenant'

export const UserStats: CollectionConfig = {
  slug: 'user-stats',
  versions: {
    drafts: false,
  },
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: [
      'user',
      'currentStreak',
      'longestStreak',
      'totalTimeSpentSeconds',
      'updatedAt',
    ],
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user this stats belongs to',
      },
    },
    {
      name: 'totalTimeSpentSeconds',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Cumulative active time in seconds',
      },
    },
    {
      name: 'currentStreak',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Current consecutive days of activity',
      },
    },
    {
      name: 'longestStreak',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Historical maximum streak',
      },
    },
    {
      name: 'lastActiveDate',
      type: 'text',
      admin: {
        description: 'Last day counted for streak (YYYY-MM-DD format)',
      },
    },
    {
      name: 'lastHeartbeatAt',
      type: 'date',
      admin: {
        description: 'Timestamp of last heartbeat received',
      },
    },
    {
      name: 'activityLog',
      type: 'array',
      maxRows: 50,
      admin: {
        description: 'Recent user activity timeline (max 50 entries)',
      },
      fields: [
        {
          name: 'actionType',
          type: 'select',
          required: true,
          options: [
            { label: 'Lesson Completed', value: 'lesson_completed' },
            { label: 'Exercise Attempted', value: 'exercise_attempted' },
            { label: 'Exercise Completed', value: 'exercise_completed' },
            { label: 'Question Asked', value: 'question_asked' },
            { label: 'Conversation Started', value: 'conversation_started' },
          ],
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: {
            description: 'Human-readable description (e.g., "Completed Lesson 3")',
          },
        },
        {
          name: 'targetId',
          type: 'text',
          admin: {
            description: 'ID of the entity (lesson/exercise/conversation ID)',
          },
        },
        {
          name: 'targetCollection',
          type: 'text',
          admin: {
            description: 'Collection slug (lessons/exercises/conversations)',
          },
        },
        {
          name: 'timestamp',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
  ],
  timestamps: true,
}
