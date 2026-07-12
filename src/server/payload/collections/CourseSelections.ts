/**
 * CourseSelections Collection
 * Logs every course pick made by a user (authenticated or anonymous).
 *
 * @fileType collection-config
 * @domain analytics
 * @pattern append-only-event-log
 * @ai-summary Append-only event log of course selections — public POST, admin-only reads
 *
 * Source-of-truth: writes happen only via the POST /api/course-selections
 * endpoint, which hashes IP and User-Agent on the server and rate-limits
 * anonymous traffic. Reads are admin-only so we can report on course
 * popularity without exposing per-user behaviour to anyone else.
 */
import type { Access, CollectionConfig } from 'payload'

const read: Access = ({ req }) => {
  const user = req.user
  if (!user || user.collection !== 'users') return false
  return user.role === 'admin'
}

const update: Access = ({ req }) => {
  const user = req.user
  if (!user || user.collection !== 'users') return false
  return user.role === 'admin'
}

const deleteAccess: Access = ({ req }) => {
  const user = req.user
  if (!user || user.collection !== 'users') return false
  return user.role === 'admin'
}

export const CourseSelections: CollectionConfig = {
  slug: 'course-selections',
  dbName: 'course_selections',
  admin: {
    useAsTitle: 'id',
    group: 'System',
    description:
      'Append-only event log of course selections (start page, homepage greeting, course card)',
    defaultColumns: ['course', 'user', 'guestId', 'source', 'gradeLevel', 'createdAt'],
  },
  access: {
    read,
    create: () => true,
    update,
    delete: deleteAccess,
  },
  fields: [
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      admin: {
        description: 'The course the user selected',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Authenticated user (null for anonymous selections)',
      },
    },
    {
      name: 'guestId',
      type: 'text',
      index: true,
      admin: {
        description:
          'Opaque client-generated ID for anonymous users — lets us count unique guests without an account',
      },
    },
    {
      name: 'gradeLevel',
      type: 'text',
      admin: {
        description: 'Mirrors the grade level the web app stores in LocalUserProfile',
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Start page', value: 'start-page' },
        { label: 'Homepage greeting', value: 'homepage-greeting' },
        { label: 'Course card', value: 'course-card' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Where in the web app the selection was made',
      },
    },
    {
      name: 'userAgentHash',
      type: 'text',
      admin: {
        hidden: true,
        description: 'SHA-256 of the User-Agent header (computed server-side)',
      },
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      admin: {
        hidden: true,
        description: 'SHA-256 of the request IP (computed server-side)',
      },
    },
  ],
  timestamps: true,
}
