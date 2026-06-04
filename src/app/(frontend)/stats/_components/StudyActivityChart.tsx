/**
 * Study Activity Chart Component
 *
 * Displays daily study activity as a bar chart using recharts.
 * Shows time spent per day over the selected timeframe.
 */

'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Activity as ActivityIcon } from 'lucide-react'

interface DailyActivity {
  date: string
  timeSpentSeconds: number
}

interface StudyActivityChartProps {
  data: DailyActivity[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-elevation-1 text-body-sm">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{formatTime(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export function StudyActivityChart({ data }: StudyActivityChartProps) {
  const t = useTranslations('stats')

  if (data.length === 0) {
    return (
      <Card className="bg-card border shadow-elevation-1 rounded-xl">
        <CardHeader>
          <CardTitle>{t('studyActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-section-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <ActivityIcon className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-body-sm font-medium text-muted-foreground">{t('noActivity')}</p>
            <p className="text-body-xs text-muted-foreground/60 mt-1">{t('noActivitySub')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Reverse to show oldest to newest (left to right)
  const chartData = [...data].reverse().map((d) => ({
    ...d,
    displayDate: formatDate(d.date),
    timeMinutes: Math.round(d.timeSpentSeconds / 60),
  }))

  return (
    <Card className="bg-card border shadow-elevation-1 rounded-xl">
      <CardHeader>
        <CardTitle>{t('studyActivity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatTime(v * 60)}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
              <Bar dataKey="timeMinutes" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="hsl(var(--primary))"
                    opacity={0.8 + (index / chartData.length) * 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
