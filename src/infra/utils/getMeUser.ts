import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../../payload-types'
import { getServerSideURL } from './getURL'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string | null
  user: User | null
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const config = (await import('@payload-config')).default as { cookiePrefix?: string }
  const cookiePrefix = config.cookiePrefix || 'payload'
  const cookieName = `${cookiePrefix}-token`
  const token = cookieStore.get(cookieName)?.value || cookieStore.get('payload-token')?.value

  if (!token) {
    if (nullUserRedirect) {
      redirect(nullUserRedirect)
    }

    return {
      token: null,
      user: null,
    }
  }

  const headerList = await headers()
  const forwardedProto = headerList.get('x-forwarded-proto')
  const forwardedHost = headerList.get('x-forwarded-host')
  const host = forwardedHost || headerList.get('host')
  const origin = host ? `${forwardedProto || 'http'}://${host}` : getServerSideURL()

  const cookieHeader = cookieStore.toString()
  const headersToSend = new Headers({
    Authorization: `JWT ${token}`,
  })
  if (cookieHeader) {
    headersToSend.set('Cookie', cookieHeader)
  }

  const meUserReq = await fetch(`${origin}/api/users/me`, {
    headers: headersToSend,
    cache: 'no-store',
  })

  if (!meUserReq.ok) {
    if (nullUserRedirect) {
      redirect(nullUserRedirect)
    }

    return {
      token,
      user: null,
    }
  }

  let user: User | null = null
  try {
    const contentType = meUserReq.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = (await meUserReq.json()) as { user?: User | null }
      user = data.user ?? null
    }
  } catch {
    user = null
  }

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && !user) {
    redirect(nullUserRedirect)
  }

  return {
    token,
    user,
  }
}
