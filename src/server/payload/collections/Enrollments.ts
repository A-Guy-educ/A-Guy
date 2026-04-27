/**
 * Enrollments Collection
 *
 * @fileType collection-config
 * @domain lms
 * @pattern enrollment, access-control
 * @ai-summary Tracks student enrollment requests and approvals for courses, granting entitlements on approval
 */

import type { CollectionConfig } from 'payload'
import type { User } from '@/payload-types'

import { adminOnly } from '../access/adminOnly'
import { isUsersCollectionUser } from '../access/isUsersCollectionUser'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'
import {
  manageEntitlementsOnChange,
  revokeEntitlementOnDelete,
} from '../hooks/enrollment/manageEntitlements'

/** Enrollment status values */
export const ENROLLMENT_STATUS = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Cancelled: 'cancelled',
  Expired: 'expired',
} as const

export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS]

/** Grant method values — mirrors User.courseEntitlements grantMethod */
export const ENROLLMENT_GRANT_METHOD = {
  Admin: 'admin',
  Payment: 'payment',
  Request: 'request',
} as const

export type EnrollmentGrantMethod =
  (typeof ENROLLMENT_GRANT_METHOD)[keyof typeof ENROLLMENT_GRANT_METHOD]

/** Returns true if user is admin */
function isAdmin(user: unknown): boolean {
  return isUsersCollectionUser(user) && (user as User).role === 'admin'
}

/** Returns true if user is the student for this enrollment record */
function isOwnEnrollment(user: unknown, data: { student?: string | { id: string } }): boolean {
  if (!isUsersCollectionUser(user)) return false
  const typedUser = user as User
  const studentId = typeof data.student === 'string' ? data.student : data.student?.id
  return studentId === typedUser.id
}

/** Field-level read access — admins see all, students see only their own */
function fieldReadAccess(user: unknown, data: { student?: string | { id: string } }): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  return isOwnEnrollment(user, data)
}

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['student', 'course', 'status', 'requestedAt', 'processedAt'],
    group: 'Learning',
    description: 'Track and manage student course enrollment requests',
  },
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      return true
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      return isAdmin(user)
    },
    delete: adminOnly,
  },
  fields: [
    tenantField,
    // Student — who is requesting enrollment
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'Student requesting enrollment',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Course — which course they want to enroll in
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      admin: {
        description: 'Course to enroll in',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Status
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: ENROLLMENT_STATUS.Pending,
      index: true,
      options: [
        { label: 'Pending', value: ENROLLMENT_STATUS.Pending },
        { label: 'Approved', value: ENROLLMENT_STATUS.Approved },
        { label: 'Rejected', value: ENROLLMENT_STATUS.Rejected },
        { label: 'Cancelled', value: ENROLLMENT_STATUS.Cancelled },
        { label: 'Expired', value: ENROLLMENT_STATUS.Expired },
      ],
      admin: {
        description: 'Current enrollment request status',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Reason for enrollment request (optional)
    {
      name: 'requestReason',
      type: 'textarea',
      admin: {
        description: 'Optional reason for the enrollment request',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // When the request was made
    {
      name: 'requestedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the enrollment request was submitted',
        readOnly: true,
      },
    },
    // When the request was processed (approved/rejected)
    {
      name: 'processedAt',
      type: 'date',
      admin: {
        description: 'When the enrollment request was processed by an admin',
        readOnly: true,
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Admin who processed the request
    {
      name: 'processedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who approved or rejected this enrollment',
        readOnly: true,
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Enrollment expiry date (optional)
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Optional expiry date for this enrollment (leave empty for no expiry)',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // How the entitlement was granted
    {
      name: 'grantMethod',
      type: 'select',
      required: true,
      defaultValue: ENROLLMENT_GRANT_METHOD.Admin,
      options: [
        { label: 'Admin Grant', value: ENROLLMENT_GRANT_METHOD.Admin },
        { label: 'Payment', value: ENROLLMENT_GRANT_METHOD.Payment },
        { label: 'Self-Request', value: ENROLLMENT_GRANT_METHOD.Request },
      ],
      admin: {
        description: 'How the course entitlement was granted',
      },
      access: {
        read: ({ req: { user }, data }) =>
          fieldReadAccess(user, data as { student?: string | { id: string } }),
      },
    },
    // Admin notes (admin-only — no field-level read restriction needed)
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Admin notes about this enrollment (not visible to students)',
      },
    },
    // Created By
    createdByField,
  ],
  hooks: {
    afterChange: [manageEntitlementsOnChange],
    afterDelete: [revokeEntitlementOnDelete],
  },
  timestamps: true,
}
