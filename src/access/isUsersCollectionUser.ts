import type { User } from '@/payload-types'

export function isUsersCollectionUser(user: unknown): user is User & { collection: 'users' } {
  if (!user || typeof user !== 'object') {
    return false
  }

  return 'collection' in user && (user as { collection?: string }).collection === 'users'
}
