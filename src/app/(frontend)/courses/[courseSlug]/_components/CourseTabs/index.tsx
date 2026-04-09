'use client'

import { cn } from '@/infra/utils/ui'
import { motion } from 'framer-motion'
import { useTranslations } from '@/ui/web/providers/I18n'

export type CourseTab = 'learn' | 'practice' | 'ask' | 'exams'

export const TAB_COLORS: Record<CourseTab, { text: string; stroke: string }> = {
  learn: { text: 'hsl(var(--tab-learn))', stroke: 'hsl(var(--tab-learn))' },
  practice: { text: 'hsl(var(--tab-practice))', stroke: 'hsl(var(--tab-practice))' },
  exams: { text: 'hsl(var(--tab-exams))', stroke: 'hsl(var(--tab-exams))' },
  ask: { text: 'hsl(var(--tab-ask))', stroke: 'hsl(var(--tab-ask))' },
}

interface CourseTabsProps {
  activeTab: CourseTab
  onTabChange: (tab: CourseTab) => void
}

const TABS: CourseTab[] = ['learn', 'practice', 'exams', 'ask']

export function CourseTabs({ activeTab, onTabChange }: CourseTabsProps) {
  const t = useTranslations('coursePage.tabs')

  return (
    <div className="py-content-gap">
      <div
        role="tablist"
        className="relative p-1 rounded-2xl flex items-center justify-center max-w-xl mx-auto bg-card border border-border/60 shadow-card"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          const color = TAB_COLORS[tab]

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              className={cn(
                'relative z-10 flex-1 px-4 py-2.5 min-h-[44px] text-body-sm rounded-xl transition-all duration-fast font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
              style={{ color: isActive ? color.text : undefined }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-card to-muted/30 border border-border/40"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  style={{ zIndex: -1 }}
                />
              )}
              <span className={cn('relative z-20', isActive && 'font-bold')}>{t(tab)}</span>
              {isActive && (
                <motion.div
                  className="absolute bottom-0.5 start-3 end-3 h-0.5 rounded-full"
                  style={{ backgroundColor: color.text }}
                  layoutId="activeIndicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
