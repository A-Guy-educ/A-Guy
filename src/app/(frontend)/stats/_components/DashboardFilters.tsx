/**
 * Dashboard Filters Component
 *
 * Course and timeframe filter controls for the stats dashboard
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'

interface Course {
  id: string
  title: string
}

interface DashboardFiltersProps {
  courses: Course[]
  selectedCourseId: string
  selectedTimeframe: 'week' | 'month' | 'overall'
  onCourseChange: (courseId: string) => void
  onTimeframeChange: (timeframe: 'week' | 'month' | 'overall') => void
}

export function DashboardFilters({
  courses,
  selectedCourseId,
  selectedTimeframe,
  onCourseChange,
  onTimeframeChange,
}: DashboardFiltersProps) {
  const t = useTranslations('stats')

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Course Filter */}
      <div className="w-full sm:w-64">
        <Select value={selectedCourseId} onValueChange={onCourseChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('allCourses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCourses')}</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeframe Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => onTimeframeChange('week')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedTimeframe === 'week'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {t('thisWeek')}
        </button>
        <button
          onClick={() => onTimeframeChange('month')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedTimeframe === 'month'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {t('thisMonth')}
        </button>
        <button
          onClick={() => onTimeframeChange('overall')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedTimeframe === 'overall'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {t('overall')}
        </button>
      </div>
    </div>
  )
}
