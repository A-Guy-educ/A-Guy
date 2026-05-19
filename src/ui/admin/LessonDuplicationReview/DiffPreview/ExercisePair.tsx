/**
 * ExercisePair — side-by-side source vs variation display.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Renders a single source-vs-output exercise pair with diff classification.
 */
'use client'

import React, { useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { DiffBadge } from './DiffBadge'
import { AdminBlockRenderer } from './AdminBlockRenderer'
import { classifyDiff } from '@/ui/admin/LessonDuplicationReview/lib/diff'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

type RegenLevel = 'light' | 'medium' | 'deep'

interface FailureInfo {
  code: string
  message: string
  label: string
}

interface ExercisePairProps {
  sourceExercise: { id: string; content: { blocks: ContentBlock[] } }
  outputExercise: { id: string; content: { blocks: ContentBlock[] } }
  exerciseIndex: number
  onLooksRight: (outputExerciseId: string) => void
  onRegenerate: (outputExerciseId: string, level: RegenLevel) => void
  onSkip: (outputExerciseId: string) => void
  onRetry?: (sourceExerciseId: string) => Promise<void>
  failureInfo?: FailureInfo | null
  isRetrying?: boolean
  isReviewed: boolean
  isFocused: boolean
}

export function ExercisePair({
  sourceExercise,
  outputExercise,
  exerciseIndex,
  onLooksRight,
  onRegenerate,
  onSkip,
  onRetry,
  failureInfo,
  isRetrying = false,
  isReviewed,
  isFocused,
}: ExercisePairProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const sourceBlocks = sourceExercise.content.blocks as ContentBlock[]
  const outputBlocks = outputExercise.content.blocks as ContentBlock[]

  const diffCategory = classifyDiff(sourceBlocks, outputBlocks)

  const handleRetry = async () => {
    if (!onRetry) return
    setRetryError(null)
    try {
      await onRetry(sourceExercise.id)
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : 'Retry failed')
    }
  }

  return (
    <div
      id={outputExercise.id}
      className={cn(
        'rounded-xl border p-card-padding bg-card transition-all duration-normal',
        isFocused
          ? 'border-primary shadow-elevation-2 ring-2 ring-primary/20'
          : 'border-border shadow-elevation-1',
      )}
    >
      {/* Exercise label + diff badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-label font-semibold text-foreground">
          Exercise {exerciseIndex + 1}
        </span>
        <DiffBadge category={diffCategory} />
        {isReviewed && <span className="ml-auto text-label text-success">Reviewed</span>}
      </div>

      {/* Side-by-side columns */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Source column */}
        <div>
          <p className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Source
          </p>
          <div className="bg-[var(--theme-elevation-50)] rounded-lg border border-border p-3 min-h-24">
            <AdminBlockRenderer blocks={sourceBlocks} />
          </div>
        </div>

        {/* Variation column */}
        <div>
          <p className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Variation
          </p>
          <div className="bg-[var(--theme-elevation-50)] rounded-lg border border-border p-3 min-h-24">
            <AdminBlockRenderer blocks={outputBlocks} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        {/* Looks right */}
        <button
          onClick={() => onLooksRight(outputExercise.id)}
          className={cn(
            'transition-all duration-normal px-3 py-1.5 rounded-lg text-label font-semibold border',
            isReviewed
              ? 'bg-success text-success-foreground border-success'
              : 'bg-success/10 text-success border-success/30 hover:bg-success/20',
          )}
        >
          Looks right
        </button>

        {/* Regenerate dropdown */}
        <div className="relative group">
          <button className="transition-all duration-normal px-3 py-1.5 rounded-lg text-label font-semibold bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20">
            Regenerate
          </button>
          <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-card border border-border rounded-lg shadow-elevation-2 overflow-hidden">
            {(['light', 'medium', 'deep'] as RegenLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => onRegenerate(outputExercise.id, level)}
                className={cn(
                  'w-full text-left px-4 py-2 text-label hover:bg-muted transition-colors duration-fast capitalize',
                  level === 'deep' && 'text-destructive',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Skip */}
        <button
          onClick={() => onSkip(outputExercise.id)}
          className="transition-all duration-normal px-3 py-1.5 rounded-lg text-label font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
        >
          Skip from output
        </button>

        {/* Retry — only shown when this exercise has a failure */}
        {failureInfo && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={cn(
              'transition-all duration-normal px-3 py-1.5 rounded-lg text-label font-semibold border',
              isRetrying
                ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                : 'bg-success/10 text-success border-success/30 hover:bg-success/20',
            )}
          >
            {isRetrying ? 'Retrying…' : 'Retry just this one'}
          </button>
        )}
      </div>

      {/* Expandable failure detail panel */}
      {failureInfo && (
        <details
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
          className="mt-3 pt-3 border-t border-border"
        >
          <summary className="flex items-center gap-2 cursor-pointer text-label text-muted-foreground hover:text-foreground transition-colors duration-normal select-none">
            <span
              className="font-mono text-xs bg-[var(--theme-elevation-100)] px-1.5 py-0.5 rounded"
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            >
              {failureInfo.code}
            </span>
            <span className="text-body-xs">Details</span>
          </summary>
          <pre
            className="mt-2 p-2 bg-[var(--theme-elevation-100)] rounded text-body-xs overflow-x-auto"
            style={{ wordBreak: 'break-all', fontSize: 12 }}
          >
            {failureInfo.message}
          </pre>
          <p className="mt-1 text-body-xs text-muted-foreground">{failureInfo.label}</p>
          {retryError && <p className="mt-1 text-body-xs text-destructive">{retryError}</p>}
        </details>
      )}
    </div>
  )
}
