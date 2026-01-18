'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'

export async function loginAction(formData: FormData) {
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
      const cookieStore = await cookies()
      cookieStore.set('payload-token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })

      return { success: true }
    }

    return { success: false, error: 'invalidCredentials' }
  } catch {
    return { success: false, error: 'invalidCredentials' }
  }
}
