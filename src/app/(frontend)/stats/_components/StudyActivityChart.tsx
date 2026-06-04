/**
 * Study Activity Chart Component
 *
 * Displays daily study time as a bar chart for the stats dashboard.
 * Uses CSS-based bars following the admin dashboard pattern.
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { BarChart3 } from 'lucide-react'

interface StudyActivityChartProps {
  data: Array<{ date: string; timeSpentSeconds: number }>
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function StudyActivityChart({ data }: StudyActivityChartProps) {
  const t = useTranslations('stats')

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border shadow-elevation-1 rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {t('studyActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-section-sm">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-body-sm font-medium text-muted-foreground ml-3">{t('noActivity')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxTime = Math.max(...data.map((d) => d.timeSpentSeconds), 1)

  return (
    <Card className="bg-card border shadow-elevation-1 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {t('studyActivity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart area */}
          <div className="flex items-end justify-between gap-2 h-32">
            {data.slice(0, 14).map((entry) => {
              const heightPercent = (entry.timeSpentSeconds / maxTime) * 100
              return (
                <div
                  key={entry.date}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${formatDate(entry.date)}: ${formatTime(entry.timeSpentSeconds)}`}
                >
                  {/* Bar */}
                  <div className="w-full bg-primary/10 rounded-t relative group">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary rounded-t transition-all duration-normal group-hover:bg-primary/80"
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-body-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {formatTime(entry.timeSpentSeconds)}
                    </div>
                  </div>
                  {/* Date label - show every other one on small screens */}
                  <span className="text-body-xs text-muted-foreground text-center hidden sm:block">
                    {formatDate(entry.date)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-body-xs text-muted-foreground pt-2 border-t">
            <span>
              {data.length} {t('days')}
            </span>
            <span>
              {t('total')}: {formatTime(data.reduce((sum, d) => sum + d.timeSpentSeconds, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
