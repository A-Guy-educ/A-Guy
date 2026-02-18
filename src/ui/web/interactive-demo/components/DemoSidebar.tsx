'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { EventLogEntry } from '../types'

interface DemoSidebarProps {
  skillScore: number
  blocksShown: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null
  sessionId: string | null
  eventLog: EventLogEntry[]
  tone?: string
}

export function DemoSidebar({
  skillScore,
  blocksShown,
  currentPhase,
  sessionId,
  eventLog,
  tone,
}: DemoSidebarProps) {
  const t = useTranslations('interactiveDemo')

  // Format timestamp for display
  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  // Get phase display text
  const getPhaseDisplay = () => {
    if (!currentPhase) return 'idle'
    return currentPhase.replace('awaiting_', '')
  }

  // Get phase badge color
  const getPhaseBadgeClass = () => {
    if (currentPhase === 'awaiting_input') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
    }
    if (currentPhase === 'awaiting_continue') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200'
  }

  return (
    <div className="demo-sidebar sticky top-[86px] self-start space-y-4">
      {/* Skill Score Panel */}
      <div className="rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('skillScore')}</h3>
        <div className="text-4xl font-bold text-foreground">{skillScore}</div>
      </div>

      {/* Session Stats Panel */}
      <div className="rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('sessionStats')}</h3>

        {/* Blocks shown */}
        <div className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
          <span className="text-sm text-muted-foreground">{t('blocksShown')}</span>
          <span className="text-sm font-semibold text-foreground">{blocksShown}</span>
        </div>

        {/* Current phase */}
        <div className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
          <span className="text-sm text-muted-foreground">{t('currentPhase')}</span>
          <span
            className={cn('text-xs font-medium px-2.5 py-1 rounded-full', getPhaseBadgeClass())}
          >
            {getPhaseDisplay()}
          </span>
        </div>

        {/* Tone */}
        <div className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
          <span className="text-sm text-muted-foreground">{t('tone')}</span>
          <span className="text-sm font-semibold text-foreground">{tone || '—'}</span>
        </div>

        {/* Session ID */}
        {sessionId && (
          <div className="pt-2 border-t border-border/60">
            <span className="text-xs text-muted-foreground">{t('sessionId')}</span>
            <div className="text-xs font-mono text-foreground/70 break-all mt-1">
              {sessionId.slice(0, 8)}...
            </div>
          </div>
        )}

        {/* Continue Note */}
        <div className="pt-3 mt-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground leading-relaxed">{t('continueNote')}</p>
        </div>
      </div>

      {/* Recent Events Panel */}
      <div className="rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('recentEvents')}</h3>
        {eventLog.length > 0 ? (
          <div className="max-h-[220px] overflow-y-auto space-y-0">
            {eventLog
              .slice()
              .reverse()
              .map((event, index) => (
                <div
                  key={`${event.timestamp}-${index}`}
                  className="flex justify-between items-start text-xs py-2 border-b border-dashed border-border/40 last:border-0"
                >
                  <span className="text-muted-foreground font-medium">{event.label}</span>
                  <span className="text-muted-foreground/70 text-[10px]">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No events yet</p>
        )}
      </div>
    </div>
  )
}
