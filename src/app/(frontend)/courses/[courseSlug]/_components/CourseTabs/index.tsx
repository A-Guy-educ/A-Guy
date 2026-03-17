'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

export type CourseTab = 'learn' | 'practice' | 'ask' | 'exams'

export const TAB_COLORS: Record<CourseTab, { text: string; stroke: string }> = {
  learn: { text: 'hsl(217 91% 60%)', stroke: 'hsl(217 91% 60%)' },
  practice: { text: 'hsl(0 72% 51%)', stroke: 'hsl(0 72% 51%)' },
  exams: { text: 'hsl(330 81% 60%)', stroke: 'hsl(330 81% 60%)' },
  ask: { text: 'hsl(142 71% 45%)', stroke: 'hsl(142 71% 45%)' },
}

interface CourseTabsProps {
  activeTab: CourseTab
  onTabChange: (tab: CourseTab) => void
}

const TABS: CourseTab[] = ['learn', 'practice', 'exams', 'ask']

export function CourseTabs({ activeTab, onTabChange }: CourseTabsProps) {
  const t = useTranslations('coursePage.tabs')

  return (
    <div className="py-4">
      <div className="bg-muted/50 p-1 rounded-full flex items-center justify-center gap-0 max-w-md mx-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                'flex-1 px-6 py-2 text-sm rounded-full transition-all font-semibold',
                isActive ? 'bg-card shadow-md' : 'hover:opacity-80',
              )}
              style={{ color: TAB_COLORS[tab].text }}
            >
              {t(tab)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
