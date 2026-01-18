'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'

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

      resolvedCookieStore.set('payload-token', result.token, {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        ...(authCookies?.domain ? { domain: authCookies.domain } : {}),
      })

      return { success: true }
    }

    return { success: false, error: 'invalidCredentials' }
  } catch {
    return { success: false, error: 'invalidCredentials' }
  }
}
