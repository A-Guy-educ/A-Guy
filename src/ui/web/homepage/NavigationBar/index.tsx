'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { usePathname } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { motion } from 'framer-motion'
import { BookOpen, Target, MessageCircle, ClipboardCheck, type LucideIcon } from 'lucide-react'

interface NavItem {
  key: string
  href: string
  color: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { key: 'study', href: '/study', color: 'hsl(217 91% 60%)', icon: BookOpen },
  { key: 'practice', href: '/practice', color: 'hsl(0 72% 51%)', icon: Target },
  { key: 'ask', href: '/ask', color: 'hsl(142 71% 45%)', icon: MessageCircle },
  { key: 'test', href: '/test', color: 'hsl(330 81% 60%)', icon: ClipboardCheck },
]

export function NavigationBar() {
  const t = useTranslations('homepage.nav')
  const pathname = usePathname()

  return (
    <nav className="bg-card py-2 border-b border-border/40">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-muted/40 p-1 rounded-xl flex items-center justify-between">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            const link = (
              <SystemLink
                key={item.key}
                href={item.href}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-1.5 py-2 px-2 md:px-3 min-h-[44px] text-body-xs md:text-body-sm rounded-lg transition-colors active:opacity-70',
                  isActive
                    ? 'font-bold'
                    : 'font-medium text-muted-foreground hover:text-foreground',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 bg-card rounded-lg shadow-elevation-1"
                    style={{ zIndex: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span
                  className="relative z-10 flex items-center justify-center gap-1.5"
                  style={isActive ? { color: item.color } : undefined}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive && 'stroke-[2.5]')} />
                  <span>{t(item.key)}</span>
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navBottomBar"
                    className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                    style={{ backgroundColor: item.color, zIndex: 10 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </SystemLink>
            )

            return link
          })}
        </div>
      </div>
    </nav>
  )
}
