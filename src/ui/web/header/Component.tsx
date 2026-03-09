import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/infra/utils/getGlobals'
import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

export async function Header() {
  const headerData: HeaderType = await getCachedGlobal('header', 1)()
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

  // User will be fetched on the client side to avoid static-to-dynamic conversion
  // This allows pages to be statically generated without using cookies() on the server
  return <HeaderClient data={headerData} version={version} />
}
