import crypto from 'crypto'
import type { Payload } from 'payload'
import type { NextResponse } from 'next/server'

type PayloadInstance = Payload

export function setAuthTokenCookie(
  response: NextResponse,
  payload: PayloadInstance,
  token: string,
) {
  const usersCollection = payload.collections?.users
  const cookiePrefix = payload.config.cookiePrefix || 'payload'
  const cookieName = `${cookiePrefix}-token`
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

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    ...(authCookies?.domain ? { domain: authCookies.domain } : {}),
  })
}

export async function loginForToken(payload: PayloadInstance, email: string, password: string) {
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

  return result.token ?? null
}

export async function rotateOAuthPassword({
  payload,
  userId,
  email,
  currentVersion,
}: {
  payload: PayloadInstance
  userId: string
  email: string
  currentVersion: number
}) {
  const nextPassword = crypto.randomBytes(32).toString('hex')
  const updateResult = await payload.update({
    collection: 'users',
    where: {
      and: [{ id: { equals: userId } }, { oauthPasswordVersion: { equals: currentVersion } }],
    },
    data: {
      password: nextPassword,
      oauthPasswordVersion: currentVersion + 1,
    },
    limit: 1,
  })

  if (updateResult.docs.length === 0) {
    return null
  }

  return loginForToken(payload, email, nextPassword)
}
