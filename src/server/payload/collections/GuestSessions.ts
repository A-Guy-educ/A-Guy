/**
 * GuestSessions Collection
 * Stores expiring sessions for anonymous chat users
 *
 * @fileType collection-config
 * @domain auth
 * @pattern session-management, expiring-records
 * @ai-summary Expiring guest sessions for anonymous chat persistence
 *
 * Security:
 * - No read access to clients (tokens never exposed)
 * - Auto-create for guests (no auth required)
 * - Admin-only delete (cleanup job)
 * - TokenHash stored instead of raw tokens (S1)
 *
 * Lifetime:
 * - Sliding TTL: 7 days of inactivity extends expiration
 * - Hard Cap: 30 days absolute maximum
 * - Status: active | expired | revoked (claimed by user)
 */
import type { Access, CollectionConfig } from 'payload'

const canDelete: Access = ({ req }) => {
  if (!req.user) return false
  return req.user.collection === 'users' && req.user.role === 'admin'
}

export const GuestSessions: CollectionConfig = {
  slug: 'guest-sessions',
  admin: {
    useAsTitle: 'id',
    group: 'System',
    description: 'Anonymous user sessions for guest chat',
    defaultColumns: ['status', 'createdAt', 'expiresAt', 'claimedByUser'],
  },
  access: {
    read: () => false,
    create: () => true,
    update: () => false,
    delete: canDelete,
  },
  dbName: 'guest-sessions',
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
        description: 'SHA-256 hash of session token (never store raw token)',
      },
    },
    {
      name: 'tokenVersion',
      type: 'number',
      required: true,
      defaultValue: 1,
      admin: {
        hidden: true,
        description: 'Allows token rotation/invalidation without session deletion',
      },
    },
    {
      name: 'createdAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: {
        description: 'Session creation timestamp',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'lastActiveAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'Last activity timestamp (extends sliding TTL)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'Sliding TTL expiration (extends on activity, clamped by hard cap)',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'hardExpiresAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'Absolute hard cap - session cannot extend beyond this',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      admin: {
        hidden: true,
        description: 'SHA-256 hash of IP address (privacy-preserving abuse tracking)',
      },
    },
    {
      name: 'userAgentHash',
      type: 'text',
      admin: {
        hidden: true,
        description: 'SHA-256 hash of User-Agent (privacy-preserving abuse tracking)',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
      defaultValue: 'active',
      required: true,
      index: true,
      admin: {
        description:
          'Session status: active = usable, expired = past TTL, revoked = claimed by user',
      },
    },
    {
      name: 'claimedByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        hidden: true,
        description: 'User who claimed this session on upgrade',
      },
    },
    {
      name: 'claimedAt',
      type: 'date',
      admin: {
        hidden: true,
        description: 'When this session was claimed by a user',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  timestamps: true,
}
