import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { authenticated } from '../access/authenticated'
import { authenticatedOrOwner } from '../access/authenticatedOrOwner'

export const LessonSessions: CollectionConfig = {
  slug: 'lesson-sessions',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'lesson',
    defaultColumns: [
      'user',
      'lesson',
      'status',
      'currentPhase',
      'currentBlockIndex',
      'skillScore',
      'updatedAt',
    ],
    group: 'Interactive Demo',
  },
  fields: [
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    // FIX #3: Explicit session phase for deterministic state transitions
    {
      name: 'currentPhase',
      type: 'select',
      required: true,
      defaultValue: 'awaiting_continue',
      options: [
        { label: 'Awaiting Input', value: 'awaiting_input' },
        { label: 'Awaiting Continue', value: 'awaiting_continue' },
      ],
      admin: {
        description:
          'Current phase: awaiting_input (question needs answer) or awaiting_continue (ready for next)',
      },
    },
    {
      name: 'currentBlockIndex',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'skillScore',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    // FIX #5: History as typed array field with maxRows for safe cap
    {
      name: 'history',
      type: 'array',
      maxRows: 200,
      admin: {
        description: 'Session interaction history (capped at 200 entries)',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'System', value: 'system' },
            { label: 'User', value: 'user' },
            { label: 'Assistant', value: 'assistant' },
          ],
        },
        {
          name: 'blockType',
          type: 'select',
          required: true,
          options: [
            { label: 'Content', value: 'content' },
            { label: 'MCQ', value: 'mcq' },
            { label: 'Open', value: 'open' },
            { label: 'Remediation', value: 'remediation' },
          ],
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
          maxLength: 5000, // FIX #9: hard limit prevents unbounded doc growth
          admin: {
            description: 'Markdown/math content (md-math-v1)',
          },
        },
        {
          name: 'timestamp',
          type: 'date',
          required: true,
        },
        {
          name: 'metadata',
          type: 'json',
          // { blockIndex, isCorrect?, selectedOptionIds?, normalizedAnswer?, scoreDelta? }
        },
      ],
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'completedAt',
      type: 'date',
    },
    {
      name: 'schemaVersion',
      type: 'number',
      required: true,
      defaultValue: 1,
    },
    {
      name: 'version',
      type: 'number',
      required: true,
      defaultValue: 1,
      // Optimistic concurrency counter
    },
    // FIX #11: processedActions with cached response for true idempotency
    {
      name: 'processedActions',
      type: 'array',
      maxRows: 50,
      admin: {
        description: 'Recent action results for idempotent retry support (FIFO, max 50)',
      },
      fields: [
        {
          name: 'actionId',
          type: 'text',
          required: true,
          index: true,
        },
        {
          name: 'createdAt',
          type: 'date',
          required: true,
        },
        {
          name: 'response',
          type: 'json',
          required: true,
          // Snapshot of the StepResponse returned for this action
        },
      ],
      defaultValue: [],
    },
    {
      name: 'remediationCounts',
      type: 'json',
      // { perBlock: Record<string, number>, total: number }
      defaultValue: { perBlock: {}, total: 0 },
    },
  ],
  timestamps: true,
}
