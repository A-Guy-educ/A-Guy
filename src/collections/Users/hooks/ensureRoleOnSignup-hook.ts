import type { FieldHook } from 'payload'

import { AccountRole } from '../roles'

/**
 * beforeChange hook that ensures role is always 'student' on user creation
 * This prevents clients from bypassing the default by sending role='admin'
 */
export const ensureRoleOnSignup: FieldHook = ({ operation, value }) => {
  // On create operations, always enforce role='student' (ignore client input)
  if (operation === 'create') {
    return AccountRole.Student
  }

  // On update operations, return the value (will be validated by field-level access control)
  return value
}
