// Role enum for type-safe role management
import enMessages from '../../../messages/en.json'

export enum Role {
  Admin = 'admin',
  Student = 'student',
}

// Runtime validation: check if a value is a valid Role
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && Object.values(Role).includes(value as Role)
}

// Parse and validate a string into Role (throws on invalid)
export function parseRole(value: unknown): Role {
  if (!isRole(value)) {
    throw new Error(`Invalid role: ${String(value)}`)
  }
  return value
}

// Role labels for UI display (sourced from language files)
export const ROLE_LABEL: Record<Role, string> = {
  [Role.Admin]: enMessages.roles.admin,
  [Role.Student]: enMessages.roles.student,
}

// All roles as an array (useful for iteration)
export const ALL_ROLES: Role[] = Object.values(Role)

// Type-safe role checking functions
export function isAdmin(role: Role): boolean {
  return role === Role.Admin
}

export function isStudent(role: Role): boolean {
  return role === Role.Student
}
