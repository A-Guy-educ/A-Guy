import { getCachedGlobal } from '@/infra/utils/getGlobals'
import React from 'react'
import type { Footer as FooterType } from '@/payload-types'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { FooterClient } from './FooterClient'

/**
 * Read version directly from package.json
 */
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
