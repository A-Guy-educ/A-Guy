/**
 * UserProgress Collection
 *
 * @fileType collection-config
 * @domain progress-tracking
 * @pattern user-owned, progress-tracking
 * @ai-summary User progress tracking for chapters, lessons, and exercises
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { authenticated } from '@/server/payload/access/authenticated'
import { authenticatedOrOwner } from '@/server/payload/access/authenticatedOrOwner'
import { tenantField } from '@/server/payload/fields/tenant'

export const UserProgress: CollectionConfig = {
  slug: 'user-progress',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'gradeLevel', 'updatedAt'],
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
        description: 'The user this progress belongs to',
      },
    },
    {
      name: 'gradeLevel',
      type: 'text',
      index: true,
      admin: {
        description: 'Grade level (e.g., "8", "ח")',
      },
    },
    {
      name: 'progressRecords',
      type: 'array',
      fields: [
        {
          name: 'recordType',
          type: 'select',
          options: [
            { label: 'Chapter', value: 'chapter' },
            { label: 'Lesson', value: 'lesson' },
            { label: 'Exercise', value: 'exercise' },
          ],
          required: true,
        },
        {
          name: 'recordId',
          type: 'text',
          required: true,
          index: true,
          admin: {
            description: 'ID of the chapter, lesson, or exercise',
          },
        },
        {
          name: 'completionPercentage',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 0,
          admin: {
            description: 'Completion percentage (0-100)',
          },
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Not Started', value: 'not_started' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Completed', value: 'completed' },
          ],
          defaultValue: 'not_started',
        },
        {
          name: 'score',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            description: 'Score for exercises (0-100)',
          },
        },
        {
          name: 'lastAccessedAt',
          type: 'date',
          admin: {
            description: 'Last time this record was accessed',
          },
        },
      ],
    },
    /**
     * Active 7-day study plan snapshots (one per course)
     *
     * Key design: Each element represents one active plan per course, keyed by courseId.
     * The effective lookup key is (userId, gradeLevel, courseId) where:
     * - userId comes from the 'user' field
     * - gradeLevel is the storage container
     * - courseId is the plan discriminator within it
     *
     * All date fields use 'text' type with YYYY-MM-DD format to eliminate timezone drift.
     */
    {
      name: 'studyPlans',
      type: 'array',
      admin: { description: 'Active 7-day study plan snapshots (one per course)' },
      fields: [
        { name: 'courseId', type: 'text', required: true, index: true },
        { name: 'examDate', type: 'text', required: true }, // YYYY-MM-DD (no timezone drift)
        { name: 'generatedAt', type: 'text', required: true }, // YYYY-MM-DD (same format)
        {
          name: 'topics',
          type: 'array',
          fields: [
            { name: 'topicId', type: 'text', required: true },
            { name: 'topicLabel', type: 'text', required: true },
            {
              name: 'mastery',
              type: 'select',
              options: ['weak', 'medium', 'strong'],
              required: true,
            },
          ],
        },
        {
          name: 'days',
          type: 'array',
          maxRows: 7,
          fields: [
            { name: 'dayId', type: 'text', required: true },
            { name: 'date', type: 'text', required: true }, // YYYY-MM-DD (no timezone drift)
            {
              name: 'activityType',
              type: 'select',
              options: ['practice', 'hybrid', 'full_simulation', 'reinforcement', 'warmup'],
              required: true,
            },
            { name: 'topicIds', type: 'json' }, // string[] stored as JSON
            {
              name: 'status',
              type: 'select',
              options: ['planned', 'completed'],
              defaultValue: 'planned',
            },
            { name: 'estimatedDurationMinutes', type: 'number', min: 0, defaultValue: 45 },
            { name: 'userTopicIds', type: 'json' }, // string[] override
            { name: 'userDurationMinutes', type: 'number', min: 0 },
            { name: 'userStartTime', type: 'text' }, // HH:MM
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
