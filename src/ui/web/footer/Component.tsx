import { getCachedGlobal } from '@/infra/utils/getGlobals'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'
import { CMSLink } from '@/ui/web/Link'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

/**
 * Minimal version display for public footer
 * Matches admin page styling: 12px, subtle color
 */
function VersionDisplay({ version }: { version: string }) {
  return <span className="text-xs text-muted-foreground/70 font-normal">v{version}</span>
}

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()
  const version = await getVersion()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground relative z-0">
      <div className="container py-3 flex flex-col items-center gap-2">
        <SystemLink className="flex items-center gap-2" href="/">
          <TelescopeLogo className="h-5 w-auto" />
          <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
            Aguy Learning Platform
          </span>
        </SystemLink>

        <div className="flex items-center gap-2 text-xs">
          {navItems.map(({ link }, i) => {
            return (
              <CMSLink
                className="text-card-foreground hover:text-primary transition-colors text-xs whitespace-nowrap"
                key={i}
                {...link}
              />
            )
          })}
          <span className="text-muted-foreground/30">|</span>
          <VersionDisplay version={version} />
          <ThemeSelector />
        </div>
      </div>
    </footer>
  )
}
