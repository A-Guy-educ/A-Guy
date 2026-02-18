'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'
import { CMSLink } from '@/ui/web/Link'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { useTranslations } from '@/ui/web/providers/I18n'

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

interface FooterClientProps {
  navItems: Footer['navItems']
  version: string
}

export function FooterClient({ navItems, version }: FooterClientProps) {
  const t = useTranslations('common.footer')

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
          <SystemLink href="/privacy" className="text-xs text-muted-foreground">
            {t('privacy')}
          </SystemLink>
          <span className="text-muted-foreground/30">|</span>
          <SystemLink href="/accessibility" className="text-xs text-muted-foreground">
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
