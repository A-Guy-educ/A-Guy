'use client'

import { cn } from '@/infra/utils/ui'

interface SessionEvent {
  action: string
  timestamp: string
}

interface SessionSidebarProps {
  skillScore: number
  blocksShown: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null
  sessionId: string | null
  events: SessionEvent[]
}

export function SessionSidebar({
  skillScore,
  blocksShown,
  currentPhase,
  sessionId,
  events,
}: SessionSidebarProps) {
  return (
    <div className="session-sidebar">
      <div className="sticky top-[73px] space-y-6">
        {/* Skill Score */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Skill Score</h3>
          <div className="text-3xl font-bold text-foreground">{skillScore}</div>
        </div>

        {/* Session Stats */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Session Stats</h3>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Blocks shown</span>
            <span className="text-sm font-medium text-foreground">{blocksShown}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current phase</span>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded',
                currentPhase === 'awaiting_input'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
              )}
            >
              {currentPhase?.replace('awaiting_', '') || 'idle'}
            </span>
          </div>

          {sessionId && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Session ID</span>
              <div className="text-xs font-mono text-foreground/70 break-all mt-1">
                {sessionId.slice(0, 8)}...
              </div>
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Events</h3>
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={index} className="flex justify-between items-start text-xs">
                  <span className="text-muted-foreground">{event.action}</span>
                  <span className="text-muted-foreground/70">{event.timestamp}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No events yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
