/**
 * @fileType component
 * @domain cody
 * @pattern popover
 * @ai-summary Popover pill listing all workflow runs for a task with status icon, relative time, branch, and external link
 */
'use client'

import { useState, useRef, useCallback } from 'react'
import { Play, Loader2, CheckCircle, XCircle, Clock, ExternalLink, ChevronDown } from 'lucide-react'
import { cn, formatRelativeTime } from '../utils'
import { useWorkflowRuns } from '../hooks'
import type { WorkflowRun } from '../types'

// ── Status icon helpers ──────────────────────────────────────────────────────

function getRunIcon(run: WorkflowRun) {
  if (run.status === 'in_progress') {
    return <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
  }
  if (run.status === 'queued') {
    return <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
  }
  // completed
  switch (run.conclusion) {
    case 'success':
      return <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
    case 'failure':
    case 'timed_out':
      return <XCircle className="w-3 h-3 text-red-400 shrink-0" />
    case 'cancelled':
      return <XCircle className="w-3 h-3 text-zinc-400 shrink-0" />
    default:
      return <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
  }
}

function getRunColor(run: WorkflowRun): string {
  if (run.status === 'in_progress') return 'text-blue-300'
  if (run.status === 'queued') return 'text-zinc-400'
  switch (run.conclusion) {
    case 'success':
      return 'text-emerald-300'
    case 'failure':
    case 'timed_out':
      return 'text-red-300'
    default:
      return 'text-zinc-400'
  }
}

// ── WorkflowRunsPopover ───────────────────────────────────────────────────────

interface WorkflowRunsPopoverProps {
  taskTitle: string
  /** Fallback run shown before data loads (task.workflowRun from list API) */
  fallbackRun?: WorkflowRun
}

export function WorkflowRunsPopover({ taskTitle, fallbackRun }: WorkflowRunsPopoverProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const { data: runs, isLoading } = useWorkflowRuns(open ? taskTitle : undefined)

  // Display runs from query when open; fall back to single run from task data
  const displayRuns: WorkflowRun[] = runs ?? (fallbackRun ? [fallbackRun] : [])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!open && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        setMenuPos({ top: rect.bottom, left: rect.right })
      }
      setOpen((prev) => !prev)
    },
    [open],
  )

  // If no fallback run and not open, don't render pill at all (no runs known)
  if (!fallbackRun && !open) {
    // Only show if we know there's at least the fallback
    return null
  }

  const runCount = runs?.length ?? (fallbackRun ? 1 : 0)

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition-all duration-150 shrink-0 border border-white/[0.1]"
      >
        <Play className="w-3 h-3" />
        {runCount > 1 ? `Runs (${runCount})` : 'Workflow'}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          {/* Popover — fixed positioning to escape overflow:hidden parents */}
          <div
            className="fixed z-[101] w-72 bg-popover/95 backdrop-blur-xl border border-white/[0.06] rounded-xl shadow-2xl shadow-black/30 py-1.5 overflow-hidden"
            style={
              menuPos
                ? { top: menuPos.top + 4, right: window.innerWidth - menuPos.left }
                : undefined
            }
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/[0.06] mb-1">
              Workflow Runs
            </div>

            {isLoading && displayRuns.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              </div>
            ) : displayRuns.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-500">No runs found</div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {displayRuns.map((run) => (
                  <a
                    key={run.id}
                    href={run.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="mt-0.5">{getRunIcon(run)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-[12px] font-medium truncate', getRunColor(run))}>
                        {run.status === 'in_progress'
                          ? 'Running'
                          : run.status === 'queued'
                            ? 'Queued'
                            : run.conclusion
                              ? run.conclusion.charAt(0).toUpperCase() + run.conclusion.slice(1)
                              : 'Unknown'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {run.head_branch && (
                          <span className="text-[11px] text-zinc-500 truncate max-w-[120px]">
                            {run.head_branch}
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-600">
                          {formatRelativeTime(run.created_at)}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
