/**
 * ConfigEntries After Read Hook
 *
 * @fileType hook
 * @domain config
 * @pattern write-only-ux
 * @ai-summary Clears secret values in Admin UI responses to implement write-only UX
 *
 * Security (CRITICAL):
 * - Secrets should not be revealed after save
 * - Admin must re-enter value to rotate/change
 * - Original ciphertext remains encrypted in database
 */

/**
 * Hide secret values in Admin UI responses
 * Used as field-level afterRead hook to clear the value field for secrets
 */
export const afterReadHideSecretValue = async ({
  siblingData,
  value,
}: {
  siblingData: { kind?: string }
  value?: string
}): Promise<string | undefined> => {
  // Check if this is a secret kind
  if (siblingData?.kind === 'secret') {
    // Return empty string for the field value to implement write-only UX
    return ''
  }

  // For variables, return the value unchanged
  return value
}
