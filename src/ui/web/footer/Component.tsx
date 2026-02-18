import { getCachedGlobal } from '@/infra/utils/getGlobals'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import React from 'react'
import { getTranslations } from 'next-intl/server'

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
  return (
    <span className="text-xs text-muted-foreground/70 font-normal" style={{ fontSize: '12px' }}>
      v{version}
    </span>
  )
}

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()
  const version = await getVersion()
  const t = await getTranslations('common.footer')

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground relative z-0">
      <div className="container py-3 flex flex-row justify-between items-center gap-2">
        <SystemLink className="flex items-center" href="/">
          <TelescopeLogo className="h-5 w-auto" />
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
          <SystemLink
            href="/privacy"
            className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
          >
            {t('privacy')}
          </SystemLink>
          <span className="text-muted-foreground/30">|</span>
          <SystemLink
            href="/accessibility"
            className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
          >
            {t('accessibility')}
          </SystemLink>
          <span className="text-muted-foreground/30">|</span>
          <VersionDisplay version={version} />
          <ThemeSelector />
        </div>
      </div>
    </footer>
  )
}
