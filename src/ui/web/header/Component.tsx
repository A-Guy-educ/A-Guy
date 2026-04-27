import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/infra/utils/getGlobals'
import { readFile } from 'fs/promises'
import { join } from 'path'
import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

async function getVersion(): Promise<string> {
  try {
    const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
    const { version } = JSON.parse(packageJson)
    return version || 'dev'
  } catch {
    return 'dev'
  }
}

export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const version = await getVersion()

  // If the global fetch transiently fails (cold-start / pool timeout),
  // render nothing rather than crashing the whole layout.
  if (!headerData) return null

  // User will be fetched on the client side to avoid static-to-dynamic conversion
  // This allows pages to be statically generated without using cookies() on the server
  return <HeaderClient data={headerData as HeaderType} version={version} />
}
