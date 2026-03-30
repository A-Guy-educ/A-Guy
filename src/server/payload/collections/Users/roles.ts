/**
 * Account Role Enum — re-exported from canonical location @/infra/auth/roles
 *
 * Kept here for backward compatibility with server-layer imports.
 * New code should import from '@/infra/auth/roles' directly.
 */
export {
  AccountRole,
  isAccountRole,
  parseAccountRole,
  ALL_ACCOUNT_ROLES,
  ACCOUNT_ROLE_LABEL,
  isAdmin,
  isStudent,
  isAdvancedContentEditor,
  Role,
  isRole,
  parseRole,
  ROLE_LABEL,
  ALL_ROLES,
} from '@/infra/auth/roles'
