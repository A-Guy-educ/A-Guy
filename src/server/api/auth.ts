import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import type { User } from 'payload'

/**
 * Check if user is authenticated (non-null and is a valid user collection user)
 */
export function isAuthenticated(user: User | null): user is User & { collection: 'users' } {
  return isUsersCollectionUser(user)
}

/**
 * Require that the user is authenticated (non-null, valid user collection)
 * @throws Error if not authenticated
 */
export function requireAuthenticated(
  user: User | null,
): asserts user is User & { collection: 'users' } {
  if (!isAuthenticated(user)) {
    throw new Error('Authentication required')
  }
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: User | null): boolean {
  if (!isAuthenticated(user)) return false
  return user.role === AccountRole.Admin
}

/**
 * Require that the user has admin role
 * @throws Error if not admin
 */
export function requireAdmin(user: User | null): asserts user is User & { collection: 'users' } {
  if (!isAuthenticated(user) || !isAdmin(user)) {
    throw new Error('Admin access required')
  }
}

/**
 * Check if request uses valid test secret (for development/testing)
 */
export function hasValidTestSecret(authHeader: string | null): boolean {
  if (!authHeader) return false
  const testSecret = process.env.TEST_ADMIN_SECRET
  if (!testSecret) return false
  return authHeader === `Bearer ${testSecret}`
}

/**
 * Require admin OR valid test secret (for development/testing)
 * @throws Error if neither condition is met
 */
export function requireAdminOrTestSecret(user: User | null, authHeader: string | null): void {
  if (hasValidTestSecret(authHeader)) return
  requireAdmin(user)
}
