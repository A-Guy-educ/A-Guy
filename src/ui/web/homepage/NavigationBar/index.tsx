'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
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
    <nav className="bg-card pb-3 pt-2 border-b border-border/60">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-muted p-1 rounded-xl flex items-center justify-between">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href

            return (
              <SystemLink
                key={item.key}
                href={item.href}
                className={cn(
                  'flex-1 py-1.5 text-xs md:text-sm rounded-lg transition-all text-center',
                  isActive
                    ? 'bg-card text-primary shadow-sm font-bold'
                    : 'text-muted-foreground font-medium hover:text-foreground',
                )}
              >
                {t(item.key)}
              </SystemLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
