'use client'

import { usePathname, useRouter } from 'next/navigation'
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
  { key: 'test', href: '/test', color: 'hsl(330 81% 60%)', icon: ClipboardCheck },
  { key: 'ask', href: '/ask', color: 'hsl(142 71% 45%)', icon: MessageCircle },
]

const VALID_ROUTES = new Set(['/study', '/practice', '/ask', '/test'])

export function NavigationBar() {
  const t = useTranslations('homepage.nav')
  const pathname = usePathname()
  const router = useRouter()

  // Only render on intended routes — not homepage, courses, etc.
  if (!VALID_ROUTES.has(pathname)) {
    return null
  }

  return (
    <nav className="py-3 px-4 md:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="relative p-1 rounded-2xl flex items-center justify-center bg-card border border-border/60 shadow-card gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <button
                key={item.key}
                onClick={() => router.push(item.href, { scroll: false })}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[48px] text-body-sm rounded-xl transition-all duration-fast font-semibold cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive ? '' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-muted/60 to-muted/20 border border-border/40"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
                    className="absolute bottom-1 left-3 right-3 h-0.5 rounded-full"
                    style={{ backgroundColor: item.color, zIndex: 10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
