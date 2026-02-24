'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

export type CourseTab = 'learn' | 'practice' | 'ask' | 'exams'

interface CourseTabsProps {
  activeTab: CourseTab
  onTabChange: (tab: CourseTab) => void
}

const TABS: CourseTab[] = ['learn', 'practice', 'ask', 'exams']

export function CourseTabs({ activeTab, onTabChange }: CourseTabsProps) {
  const t = useTranslations('coursePage.tabs')

  return (
    <div className="bg-background pb-3 pt-2 border-b border-border sticky top-0 z-base">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-muted p-1 rounded-xl flex items-center justify-between">
          {TABS.map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  'flex-1 py-1.5 text-xs md:text-sm rounded-lg transition-all',
                  isActive
                    ? 'bg-card text-primary shadow-sm font-bold'
                    : 'text-muted-foreground font-medium hover:text-foreground',
                )}
              >
                {t(tab)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
