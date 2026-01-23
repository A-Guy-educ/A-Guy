'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'

const NAV_ITEMS = [
  { key: 'study', href: '/study' },
  { key: 'practice', href: '/practice' },
  { key: 'ask', href: '/ask' },
  { key: 'test', href: '/test' },
] as const

export function NavigationBar() {
  const t = useTranslations('homepage.nav')
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex-1 text-center py-3 text-sm font-medium transition-colors',
                  'hover:text-primary hover:bg-muted/50',
                  isActive
                    ? 'text-primary bg-muted border-b-2 border-primary'
                    : 'text-muted-foreground',
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
