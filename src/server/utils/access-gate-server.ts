import { headers } from 'next/headers'
import { getPayload } from 'payload'

/**
 * Server-side auth check for RSC pages.
 * Returns true if the user is authenticated, false otherwise.
 * Uses Payload's cookie-based auth via Next.js headers().
 */
export async function isAuthenticatedServer(): Promise<boolean> {
  try {
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    return user !== null && user !== undefined
  } catch {
    return false
  }
}
