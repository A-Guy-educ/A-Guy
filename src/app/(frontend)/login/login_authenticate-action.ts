'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import {
  claimGuestConversations,
  GuestSessionClaimingInProgressError,
} from '@/server/services/guest-session-upgrade'
import { clearGuestSessionCookie, GUEST_SESSION_COOKIE_NAME } from '@/server/services/guest-session'
import { logger } from '@/infra/utils/logger'

type CookieStore = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean
      secure: boolean
      sameSite: 'lax' | 'strict' | 'none'
      path: string
      maxAge: number
    },
  ) => void
  delete: (name: string, options?: { path: string }) => void
}

export async function loginAction(formData: FormData, cookieStore?: CookieStore) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: 'invalidCredentials' }
  }

  try {
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const usersCollection = payload.collections?.users
    const shouldRestoreToken = usersCollection?.config?.auth?.removeTokenFromResponses === true
    const cookiePrefix = payload.config.cookiePrefix || 'payload'
    const cookieName = `${cookiePrefix}-token`

    if (shouldRestoreToken && usersCollection?.config?.auth) {
      const authConfig = usersCollection.config.auth as {
        removeTokenFromResponses?: true
      }
      delete authConfig.removeTokenFromResponses
    }

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    if (shouldRestoreToken && usersCollection?.config?.auth) {
      usersCollection.config.auth.removeTokenFromResponses = true
    }

    if (result.token) {
      const resolvedCookieStore = cookieStore ?? (await cookies())
      const authCookies = usersCollection?.config?.auth?.cookies
      const sameSite =
        authCookies?.sameSite === 'None'
          ? 'none'
          : authCookies?.sameSite === 'Strict'
            ? 'strict'
            : authCookies?.sameSite === 'Lax'
              ? 'lax'
              : 'lax'
      const secure = authCookies?.secure ?? process.env.NODE_ENV === 'production'

      resolvedCookieStore.set(cookieName, result.token, {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        ...(authCookies?.domain ? { domain: authCookies.domain } : {}),
      })

      if (result.user?.id) {
        try {
          const headers = new Headers()
          const currentCookies = await cookies()
          const guestToken = currentCookies.get(GUEST_SESSION_COOKIE_NAME)?.value
          if (guestToken) {
            const claimResult = await claimGuestConversations(
              payload,
              result.user.id,
              guestToken,
              headers,
            )
            // Only clear cookie if claim succeeded (claimed >= 0)
            if (claimResult.claimed >= 0) {
              clearGuestSessionCookie(headers)
              resolvedCookieStore.delete(GUEST_SESSION_COOKIE_NAME)
            } else {
              // Partial failure - log warning but don't clear cookie
              logger.warn(
                { userId: result.user.id, claimed: claimResult.claimed },
                'Guest claim incomplete - cookie retained for retry',
              )
            }
          }
        } catch (claimError) {
          if (claimError instanceof GuestSessionClaimingInProgressError) {
            // Another user is claiming - this shouldn't happen for same user, but handle gracefully
            logger.warn(
              { userId: result.user.id },
              'Guest session claim in progress by another user',
            )
          } else {
            logger.error(
              { userId: result.user.id, error: claimError },
              'Failed to claim guest conversations',
            )
          }
        }
      }

      return { success: true }
    }

    return { success: false, error: 'invalidCredentials' }
  } catch {
    return { success: false, error: 'invalidCredentials' }
  }
}
