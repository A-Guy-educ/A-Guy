import { getCachedGlobal } from '@/infra/utils/getGlobals'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'
import { CMSLink } from '@/ui/web/Link'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { headers, cookies } from 'next/headers'
import { defaultLocale, cookieName, locales } from '@/i18n/config'
import type { Locale } from '@/i18n/config'

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

async function getSystemLocale(): Promise<Locale> {
  const headersList = await headers()
  const headerLocale = headersList.get('x-locale') as Locale | null
  if (headerLocale && locales.includes(headerLocale)) return headerLocale

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(cookieName)?.value as Locale | undefined
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale

  return defaultLocale
}

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()
  const version = await getVersion()
  const systemLocale = await getSystemLocale()

  // Select nav items from the variant matching the system language
  const variants = footerData?.variants || []
  const matchedVariant = variants.find((v) => v.locale === systemLocale) || variants[0]
  const navItems = matchedVariant?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground relative z-0">
      <div className="container py-3 flex flex-row items-center gap-2">
        <SystemLink className="flex items-center" href="/">
          <TelescopeLogo className="h-5 w-auto" />
        </SystemLink>

        <span className="flex-1 text-center text-xs font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
          Aguy Learning Platform
        </span>

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
