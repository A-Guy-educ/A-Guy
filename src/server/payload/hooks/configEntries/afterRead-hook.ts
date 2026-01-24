/**
 * ConfigEntries After Read Hook
 *
 * @fileType hook
 * @domain config
 * @pattern write-only-ux
 * @ai-summary Clears secret values in Admin UI responses, but skips for internal runtime load
 *
 * Security (CRITICAL):
 * - Secrets should not be revealed after save in Admin UI
 * - Admin must re-enter value to rotate/change
 * - Original ciphertext remains encrypted in database
 * - Runtime loader can bypass this via context flag to get ciphertext
 */

import type { FieldHookArgs } from 'payload'

/**
 * Hide secret values in Admin UI responses
 * Used as field-level afterRead hook on the `value` field
 *
 * CRITICAL: Skip clearing when req.context.internalConfigLoad is true
 * This allows the runtime loader to get actual ciphertext values
 */
export const afterReadHideSecretValue = async ({ siblingData, value, req }: FieldHookArgs) => {
  // Check if this is an internal config load (runtime loader)
  // If so, return the actual value (ciphertext) so it can be decrypted
  if (req?.context?.internalConfigLoad === true) {
    return value
  }

  // Check if this is a secret kind
  if (siblingData?.kind === 'secret') {
    // Return empty string for the field value to implement write-only UX
    return ''
  }

  // For variables, return the value unchanged
  return value
}
