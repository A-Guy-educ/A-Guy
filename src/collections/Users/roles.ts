/**
 * Account Role Enum
 *
 * Defines user permission levels in the system.
 * NOT to be confused with ChatRole in src/lib/ai/chat-message-role.ts
 *
 * Values:
 * - admin: Platform administrator with full access
 * - student: Learner with standard access (default role)
 */
import enMessages from '../../../messages/en.json' with { type: 'json' }

export enum AccountRole {
  Admin = 'admin',
  Student = 'student',
}

// Runtime validation: check if a value is a valid AccountRole
export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && Object.values(AccountRole).includes(value as AccountRole)
}

// Parse and validate a string into AccountRole (throws on invalid)
export function parseAccountRole(value: unknown): AccountRole {
  if (!isAccountRole(value)) {
    throw new Error(`Invalid account role: ${String(value)}`)
  }
  return value
}

// Role labels for UI display (sourced from language files)
export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  [AccountRole.Admin]: enMessages.roles.admin,
  [AccountRole.Student]: enMessages.roles.student,
}

// All roles as an array (useful for iteration)
export const ALL_ACCOUNT_ROLES: AccountRole[] = Object.values(AccountRole)

// Type-safe role checking functions
export function isAdmin(role: AccountRole): boolean {
  return role === AccountRole.Admin
}

export function isStudent(role: AccountRole): boolean {
  return role === AccountRole.Student
}

// =============================================================================
// Backward Compatibility
// =============================================================================
// These will be removed in a future version after full migration

/** @deprecated Use AccountRole instead */
export const Role = AccountRole

/** @deprecated Use isAccountRole instead */
export const isRole = isAccountRole

/** @deprecated Use parseAccountRole instead */
export const parseRole = parseAccountRole

/** @deprecated Use ACCOUNT_ROLE_LABEL instead */
export const ROLE_LABEL = ACCOUNT_ROLE_LABEL

/** @deprecated Use ALL_ACCOUNT_ROLES instead */
export const ALL_ROLES = ALL_ACCOUNT_ROLES
