'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'

export async function logoutAction() {
  const config = (await import('@payload-config')).default
  const payload = await getPayload({ config })
  const cookiePrefix = payload.config.cookiePrefix || 'payload'
  const cookieName = `${cookiePrefix}-token`

  const cookieStore = await cookies()
  cookieStore.delete(cookieName)
  return { success: true }
}
