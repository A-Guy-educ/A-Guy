import crypto from 'crypto'
import type { Payload } from 'payload'
import type { NextRequest, NextResponse } from 'next/server'

import type { GoogleUserInfo } from './google-oauth'
import { buildRedirect } from './google-oauth-redirect'
import { createGoogleUser, findExistingUser } from './google-oauth-users'
import { loginForToken, rotateOAuthPassword, setAuthTokenCookie } from './google-oauth-session'

type PayloadInstance = Payload

export async function handleGoogleLoginMode({
  request,
  payload,
  googleUser,
  normalizedEmail,
  safeReturnTo,
}: {
  request: NextRequest
  payload: PayloadInstance
  googleUser: GoogleUserInfo
  normalizedEmail: string
  safeReturnTo: string
}): Promise<NextResponse> {
  const existingUser = await findExistingUser(payload, googleUser.sub, normalizedEmail)

  if (existingUser) {
    const hasGoogleIdentity = existingUser.googleSub === googleUser.sub

    if (hasGoogleIdentity && existingUser.localAuthEnabled === false) {
      const currentVersion =
        typeof existingUser.oauthPasswordVersion === 'number'
          ? existingUser.oauthPasswordVersion
          : 0

      let token = await rotateOAuthPassword({
        payload,
        userId: existingUser.id,
        email: existingUser.email,
        currentVersion,
      })

      if (!token) {
        const latestUser = await payload.findByID({
          collection: 'users',
          id: existingUser.id,
          depth: 0,
        })
        const nextVersion =
          typeof latestUser.oauthPasswordVersion === 'number' ? latestUser.oauthPasswordVersion : 0

        token = await rotateOAuthPassword({
          payload,
          userId: existingUser.id,
          email: existingUser.email,
          currentVersion: nextVersion,
        })
      }

      if (token) {
        const response = buildRedirect(request, safeReturnTo)
        setAuthTokenCookie(response, payload, token)
        return response
      }
    }

    return buildRedirect(
      request,
      `/login?error=account_exists&returnTo=${encodeURIComponent(safeReturnTo)}`,
    )
  }

  const password = crypto.randomBytes(32).toString('hex')
  const name = googleUser.name?.trim() || 'Student'

  await createGoogleUser({ payload, name, normalizedEmail, password, googleUser })

  const token = await loginForToken(payload, normalizedEmail, password)
  const response = buildRedirect(request, safeReturnTo)

  if (token) {
    setAuthTokenCookie(response, payload, token)
  }

  return response
}
