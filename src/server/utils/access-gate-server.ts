import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

interface AuthResult {
  user: { id: string; role: string } | null
  payload: Payload
}

/**
 * Server-side auth check for RSC pages.
 * Returns the authenticated user and payload instance, or null user.
 */
export async function getAuthenticatedUserServer(): Promise<AuthResult> {
  const config = (await import('@payload-config')).default
  const payload = await getPayload({ config })
  try {
    const { user } = await payload.auth({ headers: await headers() })
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: user ? { id: user.id, role: (user as any).role ?? 'student' } : null,
      payload,
    }
  } catch {
    return { user: null, payload }
  }
}

/**
 * Server-side auth check for RSC pages.
 * Returns true if the user is authenticated, false otherwise.
 * Uses Payload's cookie-based auth via Next.js headers().
 */
export async function isAuthenticatedServer(): Promise<boolean> {
  const { user } = await getAuthenticatedUserServer()
  return user !== null
}
