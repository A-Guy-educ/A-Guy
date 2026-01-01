'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

interface FooterClientProps {
  data: Footer
}

export function FooterClient({ data }: FooterClientProps) {
  const pathname = usePathname()

  // Hide footer on notebook/exercise pages
  // Check for /exercises/ in the pathname
  if (pathname && pathname.includes('/exercises/')) {
    return null
  }

  const navItems = data?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href="/">
          <Logo className="invert dark:invert-0" />
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
