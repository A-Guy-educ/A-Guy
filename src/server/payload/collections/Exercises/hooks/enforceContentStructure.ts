import { AccountRole } from '@/infra/auth/roles'
import type { User } from '@/payload-types'
import { validateStructuralInvariance } from '@/utils/structure-validator'
import { APIError } from 'payload'

/**
 * Server-side structural validation hook for exercise content.
 *
 * This hook runs before any update operation and validates that:
 * - Admins can change structure freely (trusted users)
 * - AdvancedContentEditors can only modify content values, not structure
 * - Other users are also blocked from structural changes (defense-in-depth)
 *
 * Structure changes include:
 * - Adding/removing keys
 * - Changing array lengths
 * - Changing value types
 */
export async function enforceContentStructure(hookArgs: unknown): Promise<unknown> {
  // Note: This receives the full args from Payload, but we extract what we need
  const args = hookArgs as {
    req: { user: User | null }
    data: unknown
    operation: string
    originalDoc: unknown
  }
  const { req, data: hookData, operation, originalDoc } = args

  // Only run on update operations
  if (operation !== 'update') {
    return hookData
  }

  const user = req.user as User | null

  // If no user, block the operation (shouldn't happen due to access control)
  if (!user) {
    throw new APIError('Unauthorized', 401)
  }

  // Admins can change structure freely
  if (user.role === AccountRole.Admin) {
    return hookData
  }

  // Get original content from the existing document
  const originalContent = (originalDoc as unknown as { content?: unknown })?.content

  // If no original content exists, allow the operation (first update is OK)
  if (!originalContent) {
    return hookData
  }

  // Get incoming content
  const incomingContent = (hookData as unknown as { content?: unknown })?.content

  // If no incoming content, allow the operation
  if (!incomingContent) {
    return hookData
  }

  // For non-admin users (AdvancedContentEditors, students, etc.):
  // enforce structural validation to prevent schema breakage
  const structureResult = validateStructuralInvariance(originalContent, incomingContent)

  if (!structureResult.valid) {
    const errors = structureResult.errors
    const errorMessages = errors
      .slice(0, 3) // Limit error messages
      .map((e) => `${e.path || 'root'}: ${e.message}`)
      .join('; ')

    throw new APIError(`Structure change not allowed: ${errorMessages}`, 400)
  }

  return hookData
}
