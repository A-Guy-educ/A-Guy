import { FooterClient } from './Component.client'
import { getCachedGlobal } from '@/infra/utils/getGlobals'
import { readFile } from 'fs/promises'
import { join } from 'path'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'

async function getVersion(): Promise<string> {
  try {
    const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
    const { version } = JSON.parse(packageJson)
    return version || 'dev'
  } catch {
    return 'dev'
  }
}

export async function Footer() {
  const footerData: FooterType = await getCachedGlobal('footer', 1)()
  const version = await getVersion()

  const navItems = footerData?.navItems || []

  return <FooterClient navItems={navItems} version={version} />
}
