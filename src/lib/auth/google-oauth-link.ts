import type { Payload } from 'payload'
import { NextResponse, type NextRequest } from 'next/server'

import type { GoogleUserInfo } from './google-oauth'
import { buildRedirect } from './google-oauth-redirect'
import { buildGoogleIdentity, findLinkedUser, linkGoogleIdentity } from './google-oauth-users'
import { getMeUser } from '@/utilities/getMeUser'

type PayloadInstance = Payload

export async function handleGoogleLinkMode({
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
  const { user } = await getMeUser()
  if (!user) {
    return buildRedirect(
      request,
      `/login?error=account_exists&returnTo=${encodeURIComponent(safeReturnTo)}`,
    )
  }

  const alreadyLinked = await findLinkedUser(payload, googleUser.sub, user.id)
  if (alreadyLinked) {
    return buildRedirect(
      request,
      `/login?error=oauth_already_linked&returnTo=${encodeURIComponent(safeReturnTo)}`,
    )
  }

  const identity = buildGoogleIdentity(googleUser, normalizedEmail)
  await linkGoogleIdentity({ payload, user, identity, normalizedEmail })

  const redirectUrl = new URL(safeReturnTo, request.url)
  redirectUrl.searchParams.set('success', 'google_linked')
  return NextResponse.redirect(redirectUrl)
}
