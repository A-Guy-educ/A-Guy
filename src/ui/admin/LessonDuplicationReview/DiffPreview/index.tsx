/**
 * DiffPreview — side-by-side diff preview for lesson duplication review.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows source vs variation side-by-side with diff classification for all exercises.
 */
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ExercisePair } from './ExercisePair'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

type RegenLevel = 'light' | 'medium' | 'deep'

interface ExercisePairData {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
  sourceContent: { blocks: ContentBlock[] }
  outputContent: { blocks: ContentBlock[] }
}

interface FailureEntry {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
}

interface DiffPreviewProps {
  exercisePairs: ExercisePairData[]
  failures: FailureEntry[]
  reviewedIds: Set<string>
  onLooksRight: (outputExerciseId: string) => void
  onRegenerate: (outputExerciseId: string, level: RegenLevel) => void
  onSkip: (outputExerciseId: string) => void
  onJumpToExercise: (outputExerciseId: string) => void
}

interface ShortcutHintProps {
  visible: boolean
}

function ShortcutHints({ visible }: ShortcutHintProps) {
  if (!visible) return null
  return (
    <div className="absolute right-4 top-full mt-2 bg-[var(--theme-elevation-200)] border border-[var(--theme-elevation-300)] rounded-lg p-3 text-label z-20 shadow-elevation-2">
      <table className="text-foreground">
        <tbody>
          {[
            ['j / k', 'Navigate exercises'],
            ['r', 'Regenerate (medium)'],
            ['s', 'Skip from output'],
            ['Enter', 'Looks right'],
            ['?', 'Toggle this help'],
          ].map(([key, desc]) => (
            <tr key={key}>
              <td className="pr-3 font-mono text-primary font-semibold">{key}</td>
              <td className="text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DiffPreview({
  exercisePairs,
  failures,
  reviewedIds,
  onLooksRight,
  onRegenerate,
  onSkip,
  onJumpToExercise,
}: DiffPreviewProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [shortcutsVisible, setShortcutsVisible] = useState(false)

  const totalExercises = exercisePairs.length
  const reviewedCount = reviewedIds.size
  const unresolvedFailures = failures.filter((f) => !f.resolved).length

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'j':
          setFocusedIndex((i) => Math.min(i + 1, totalExercises - 1))
          break
        case 'k':
          setFocusedIndex((i) => Math.max(i - 1, 0))
          break
        case 'r':
          if (exercisePairs[focusedIndex]) {
            onRegenerate(exercisePairs[focusedIndex].outputExerciseId, 'medium')
          }
          break
        case 's':
          if (exercisePairs[focusedIndex]) {
            onSkip(exercisePairs[focusedIndex].outputExerciseId)
          }
          break
        case 'Enter':
          if (exercisePairs[focusedIndex]) {
            onLooksRight(exercisePairs[focusedIndex].outputExerciseId)
          }
          break
        case '?':
          setShortcutsVisible((v) => !v)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedIndex, totalExercises, exercisePairs, onLooksRight, onRegenerate, onSkip])

  // Scroll focused pair into view
  useEffect(() => {
    const pair = exercisePairs[focusedIndex]
    if (pair) {
      const el = document.getElementById(pair.outputExerciseId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusedIndex, exercisePairs])

  const jumpToExercise = useCallback(
    (exerciseRef: string) => {
      const idx = exercisePairs.findIndex((p) => p.sourceExerciseId === exerciseRef)
      if (idx >= 0) {
        setFocusedIndex(idx)
        onJumpToExercise(exercisePairs[idx].outputExerciseId)
      }
    },
    [exercisePairs, onJumpToExercise],
  )

  if (exercisePairs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-body-sm">
        No exercises to preview.
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Sticky summary bar */}
      <div className="sticky top-0 z-10 bg-[var(--theme-elevation-100)] border-b border-[var(--theme-elevation-200)] px-4 py-3 flex items-center gap-4 mb-4 rounded-t-lg">
        <span className="text-body-sm font-semibold text-foreground">
          {reviewedCount} of {totalExercises} exercises reviewed
          {unresolvedFailures > 0 && (
            <span className="text-destructive ml-2">
              · {unresolvedFailures} failure{unresolvedFailures !== 1 ? 's' : ''} remaining
            </span>
          )}
        </span>

        <div className="flex-1" />

        {/* Keyboard shortcut toggle */}
        <div className="relative">
          <button
            onClick={() => setShortcutsVisible((v) => !v)}
            className="text-label text-muted-foreground hover:text-foreground transition-colors duration-normal"
            title="Keyboard shortcuts"
          >
            ?
          </button>
          <ShortcutHints visible={shortcutsVisible} />
        </div>

        {/* Exercise navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFocusedIndex((i) => Math.max(i - 1, 0))}
            disabled={focusedIndex === 0}
            className="transition-all duration-normal px-2 py-1 rounded border border-border text-label hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span className="text-label text-foreground">
            {focusedIndex + 1} / {totalExercises}
          </span>
          <button
            onClick={() => setFocusedIndex((i) => Math.min(i + 1, totalExercises - 1))}
            disabled={focusedIndex === totalExercises - 1}
            className="transition-all duration-normal px-2 py-1 rounded border border-border text-label hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>

      {/* Diff Preview heading */}
      <h2 className="text-heading-sm font-semibold text-foreground mb-4">Diff Preview</h2>

      {/* Failure rows with jump links */}
      {failures.filter((f) => !f.resolved).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {failures
            .filter((f) => !f.resolved)
            .map((failure) => (
              <button
                key={`${failure.exerciseRef}-${failure.code}`}
                onClick={() => jumpToExercise(failure.exerciseRef)}
                className="text-label text-destructive hover:text-destructive/80 underline transition-colors duration-normal"
              >
                Jump to {failure.exerciseRef.slice(0, 8)}… ({failure.code})
              </button>
            ))}
        </div>
      )}

      {/* Exercise pairs */}
      <div className="flex flex-col gap-4">
        {exercisePairs.map((pair, idx) => (
          <ExercisePair
            key={pair.outputExerciseId}
            sourceExercise={{
              id: pair.sourceExerciseId,
              content: pair.sourceContent as { blocks: ContentBlock[] },
            }}
            outputExercise={{
              id: pair.outputExerciseId,
              content: pair.outputContent as { blocks: ContentBlock[] },
            }}
            exerciseIndex={idx}
            onLooksRight={onLooksRight}
            onRegenerate={onRegenerate}
            onSkip={onSkip}
            isReviewed={reviewedIds.has(pair.outputExerciseId)}
            isFocused={idx === focusedIndex}
          />
        ))}
      </div>
    </div>
  )
}
