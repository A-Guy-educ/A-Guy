import type { User } from '@/payload-types'

export function isUsersCollectionUser(user: unknown): user is User & { collection?: 'users' } {
  if (!user || typeof user !== 'object') {
    return false
  }

  const candidate = user as { id?: unknown; collection?: unknown }
  if (candidate.id === undefined || candidate.id === null) {
    return false
  }

  if ('collection' in candidate && candidate.collection !== 'users') {
    return false
  }

  return true
}
