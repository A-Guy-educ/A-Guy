import type { Payload } from 'payload'

import { AccountRole } from '@/collections/Users/roles'
import type { User } from '@/payload-types'
import type { GoogleUserInfo } from './google-oauth'

type PayloadInstance = Payload

export function buildGoogleIdentity(googleUser: GoogleUserInfo, normalizedEmail: string) {
  return {
    provider: 'google' as const,
    providerUserId: googleUser.sub,
    email: normalizedEmail,
    linkedAt: new Date().toISOString(),
    profile: {
      picture: googleUser.picture,
      locale: googleUser.locale,
      email_verified: googleUser.email_verified,
    },
  }
}

export async function findExistingUser(
  payload: PayloadInstance,
  googleSub: string,
  normalizedEmail: string,
) {
  const bySub = await payload.find({
    collection: 'users',
    where: { googleSub: { equals: googleSub } },
    limit: 1,
    depth: 0,
  })

  if (bySub.docs[0]) {
    return bySub.docs[0]
  }

  const byEmail = await payload.find({
    collection: 'users',
    where: { email: { equals: normalizedEmail } },
    limit: 1,
    depth: 0,
  })

  return byEmail.docs[0]
}

export async function findLinkedUser(payload: PayloadInstance, googleSub: string, userId: string) {
  const result = await payload.find({
    collection: 'users',
    where: {
      and: [{ id: { not_equals: userId } }, { googleSub: { equals: googleSub } }],
    },
    limit: 1,
    depth: 0,
  })

  return result.docs[0]
}

export async function linkGoogleIdentity({
  payload,
  user,
  identity,
  normalizedEmail,
}: {
  payload: PayloadInstance
  user: User
  identity: ReturnType<typeof buildGoogleIdentity>
  normalizedEmail: string
}) {
  if (user.googleSub === identity.providerUserId) {
    return
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: false,
    user,
    data: {
      googleSub: identity.providerUserId,
      googleEmail: normalizedEmail,
      oauthIdentities: [...(user.oauthIdentities || []), identity],
    },
  })
}

export async function createGoogleUser({
  payload,
  name,
  normalizedEmail,
  password,
  googleUser,
}: {
  payload: PayloadInstance
  name: string
  normalizedEmail: string
  password: string
  googleUser: GoogleUserInfo
}) {
  const identity = buildGoogleIdentity(googleUser, normalizedEmail)

  return payload.create({
    collection: 'users',
    overrideAccess: false,
    draft: false,
    data: {
      name,
      email: normalizedEmail,
      password,
      role: AccountRole.Student,
      registrationMethod: 'google',
      registeredAt: new Date().toISOString(),
      localAuthEnabled: false,
      googleSub: googleUser.sub,
      googleEmail: normalizedEmail,
      oauthIdentities: [identity],
    },
  })
}
