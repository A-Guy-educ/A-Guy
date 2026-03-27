import type { Field } from 'payload'

/**
 * Content Status constants for courses and lessons.
 *
 * Used to display visual badges to students:
 * - "Soon": Upcoming content, locked from student access
 * - "Just Added": New content, fully accessible with visual highlight
 */
export const CONTENT_STATUS_OPTIONS = ['none', 'soon', 'justAdded', 'custom'] as const
export type ContentStatus = (typeof CONTENT_STATUS_OPTIONS)[number]
export const DEFAULT_CONTENT_STATUS: ContentStatus = 'none'

/**
 * Reusable content status fields for courses and lessons.
 *
 * Fields:
 * - contentStatus: Select field for badge type (none/soon/justAdded)
 * - contentStatusVisible: Controls visibility for "Soon" content
 * - contentStatusExpiresAt: Optional expiry date for "Just Added" badge
 */
export const contentStatusFields: Field[] = [
  {
    name: 'contentStatus',
    type: 'select',
    required: true,
    index: true,
    defaultValue: DEFAULT_CONTENT_STATUS,
    options: CONTENT_STATUS_OPTIONS.map((status) => ({
      label:
        status === 'none'
          ? 'None'
          : status === 'soon'
            ? 'Soon'
            : status === 'justAdded'
              ? 'Just Added'
              : 'Custom',
      value: status,
    })),
    admin: {
      position: 'sidebar',
      description: 'Content status badge displayed to students',
    },
  },
  {
    name: 'contentStatusVisible',
    type: 'checkbox',
    defaultValue: true,
    admin: {
      position: 'sidebar',
      description: 'When unchecked, "Soon" content is completely hidden from student listings',
      condition: (data) => data?.contentStatus === 'soon',
    },
  },
  {
    name: 'contentStatusExpiresAt',
    type: 'date',
    admin: {
      position: 'sidebar',
      description: 'Badge auto-expires after this date (leave empty for permanent badge)',
      condition: (data) => data?.contentStatus === 'justAdded',
    },
  },
  {
    name: 'contentStatusLabel',
    type: 'text',
    admin: {
      position: 'sidebar',
      description: 'Custom badge text (e.g. "מותאם לבגרות")',
      condition: (data) => data?.contentStatus === 'custom',
    },
  },
]
