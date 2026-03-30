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
        className="bg-muted/50 p-1 rounded-full flex items-center justify-center gap-0 max-w-md mx-auto"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              className={cn(
                'relative flex-1 px-6 py-2 min-h-[44px] text-body-sm rounded-full transition-colors duration-fast font-semibold',
                !isActive && 'hover:opacity-hover',
              )}
              style={{ color: TAB_COLORS[tab].text }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-card rounded-full shadow-card"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {t(tab)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
