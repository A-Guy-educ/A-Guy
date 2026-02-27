/**
 * Create UserSettings Hook
 *
 * Automatically creates a user_settings record when a new user is created.
 * This runs in the same transaction as user creation for data integrity.
 */

import type { CollectionAfterChangeHook } from 'payload'

/**
 * Hook that creates a user_settings record after user creation
 */
export const createUserSettings: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  // Only run on create operations
  if (operation !== 'create') {
    return doc
  }

  try {
    await req.payload.create({
      collection: 'user_settings',
      data: {
        user: doc.id,
      },
      req, // Pass req for transaction safety
    })
  } catch (error) {
    // Log error but don't fail user creation
    // This could fail if user_settings has unique constraint on user field
    // and there's already a record (e.g., from a previous failed attempt)
    req.payload.logger.error(
      {
        err: error,
        userId: doc.id,
      },
      'Failed to create user_settings record',
    )
  }

  return doc
}
