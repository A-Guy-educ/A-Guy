'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

export type CourseTab = 'learn' | 'practice' | 'ask' | 'exams'

export const TAB_COLORS: Record<CourseTab, { text: string; stroke: string }> = {
  learn: { text: '#2563eb', stroke: '#2563eb' },
  practice: { text: '#b91c1c', stroke: '#b91c1c' },
  exams: { text: '#059669', stroke: '#059669' },
  ask: { text: '#8b5cf6', stroke: '#8b5cf6' },
}

interface CourseTabsProps {
  activeTab: CourseTab
  onTabChange: (tab: CourseTab) => void
}

const TABS: CourseTab[] = ['learn', 'practice', 'ask', 'exams']

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
                'flex-1 px-6 py-2 text-sm rounded-full transition-all',
                isActive
                  ? 'bg-card font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              style={isActive ? { color: TAB_COLORS[tab].text } : undefined}
            >
              {t(tab)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
