import { cookies } from 'next/headers'
import type { Payload } from 'payload'

export async function setSignupAuthCookie(payload: Payload, email: string, password: string) {
  const cookieStore = await cookies()
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

  const token = await payload.login({
    collection: 'users',
    data: { email, password },
  })

  if (shouldRestoreToken && usersCollection?.config?.auth) {
    usersCollection.config.auth.removeTokenFromResponses = true
  }

  if (token && 'token' in token && token.token) {
    cookieStore.set(cookieName, token.token, {
      httpOnly: true,
      secure:
        usersCollection?.config?.auth?.cookies?.secure ?? process.env.NODE_ENV === 'production',
      sameSite:
        usersCollection?.config?.auth?.cookies?.sameSite === 'None'
          ? 'none'
          : usersCollection?.config?.auth?.cookies?.sameSite === 'Strict'
            ? 'strict'
            : usersCollection?.config?.auth?.cookies?.sameSite === 'Lax'
              ? 'lax'
              : 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      ...(usersCollection?.config?.auth?.cookies?.domain
        ? { domain: usersCollection.config.auth.cookies.domain }
        : {}),
    })
  }
}
