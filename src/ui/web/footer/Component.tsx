import { getCachedGlobal } from '@/infra/utils/getGlobals'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'
import { CMSLink } from '@/ui/web/Link'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground relative z-0">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href="/">
          <TelescopeLogo className="h-8 w-auto" />
        </Link>

        <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
          <ThemeSelector />
          <nav className="flex flex-col md:flex-row gap-4">
            {navItems.map(({ link }, i) => {
              return (
                <CMSLink
                  className="text-card-foreground hover:text-primary transition-colors"
                  key={i}
                  {...link}
                />
              )
            })}
          </nav>
        </div>
      </div>
    </footer>
  )
}
