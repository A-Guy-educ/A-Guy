import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { Header as HeaderType, User } from '@/payload-types'

export async function Header() {
  const headerData: HeaderType = await getCachedGlobal('header', 1)()

  // Get current user from Payload auth
  let user: User | null = null
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')

    if (token) {
      const payload = await getPayload({ config })
      // Create a Headers object with the cookie
      const headers = new Headers()
      headers.set('cookie', `payload-token=${token.value}`)
      const result = await payload.auth({ headers })
      user = result.user as User | null
    }
  } catch (_error) {
    // Silently fail - user not authenticated
  }

  return <HeaderClient data={headerData} user={user} />
}
