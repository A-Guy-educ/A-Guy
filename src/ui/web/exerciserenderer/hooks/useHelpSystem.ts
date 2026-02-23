/**
 * Help System Hook
 *
 * Manages per-question help state (hint → guiding → solution progression)
 * and emits system events for analytics tracking.
 */

'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { systemEventBus, SYSTEM_EVENTS } from '@/infra/system-events'
import type { HelpUsageState, QuestionBlock } from '../types'

interface UseHelpSystemProps {
  questionBlocks: QuestionBlock[]
  lessonId: string
  exerciseId: string
  locale?: string
}

interface UseHelpSystemReturn {
  helpUsage: Record<string, HelpUsageState>
  activeHelp: Record<string, 'hint' | 'guiding' | 'solution' | null>
  handleHintClick: (questionId: string) => void
  handleGuidingClick: (questionId: string) => void
  handleSolutionClick: (questionId: string) => void
}

const INITIAL_HELP_STATE: HelpUsageState = {
  hintShown: false,
  guidingUsed: false,
  solutionUnlocked: false,
}

export function useHelpSystem({
  questionBlocks,
  lessonId,
  exerciseId,
  locale,
}: UseHelpSystemProps): UseHelpSystemReturn {
  const [helpUsage, setHelpUsage] = useState<Record<string, HelpUsageState>>({})
  const [activeHelp, setActiveHelp] = useState<
    Record<string, 'hint' | 'guiding' | 'solution' | null>
  >({})

  // Track which questions have had solution_unlocked emitted (fire-once)
  const unlockEmittedRef = useRef<Set<string>>(new Set())

  const questionIds = useMemo(() => questionBlocks.map((q) => q.id), [questionBlocks])

  const getHelpState = useCallback(
    (questionId: string): HelpUsageState => {
      return helpUsage[questionId] ?? INITIAL_HELP_STATE
    },
    [helpUsage],
  )

  const basePayload = useCallback(
    (questionId: string) => ({
      lesson_id: lessonId,
      exercise_id: exerciseId,
      question_id: questionId,
      locale,
    }),
    [lessonId, exerciseId, locale],
  )

  const handleHintClick = useCallback(
    (questionId: string) => {
      if (!questionIds.includes(questionId)) return

      const current = getHelpState(questionId)
      const currentActive = activeHelp[questionId]

      // Toggle: if hint is already active, close it
      if (currentActive === 'hint') {
        setActiveHelp((prev) => ({ ...prev, [questionId]: null }))
        return
      }

      // Show hint
      setActiveHelp((prev) => ({ ...prev, [questionId]: 'hint' }))

      if (!current.hintShown) {
        const next: HelpUsageState = {
          ...current,
          hintShown: true,
          solutionUnlocked: current.guidingUsed,
        }
        setHelpUsage((prev) => ({ ...prev, [questionId]: next }))

        systemEventBus.emit(SYSTEM_EVENTS.HINT_CLICKED, {
          ...basePayload(questionId),
          hint_used: true,
        })

        // Check if solution just became unlocked
        if (next.solutionUnlocked && !unlockEmittedRef.current.has(questionId)) {
          unlockEmittedRef.current.add(questionId)
          systemEventBus.emit(SYSTEM_EVENTS.SOLUTION_UNLOCKED, {
            ...basePayload(questionId),
            hint_used: true,
            guiding_used: true,
          })
        }
      }
    },
    [questionIds, getHelpState, activeHelp, basePayload],
  )

  const handleGuidingClick = useCallback(
    (questionId: string) => {
      if (!questionIds.includes(questionId)) return

      const current = getHelpState(questionId)
      const currentActive = activeHelp[questionId]

      // Toggle: if guiding is already active, close it
      if (currentActive === 'guiding') {
        setActiveHelp((prev) => ({ ...prev, [questionId]: null }))
        return
      }

      setActiveHelp((prev) => ({ ...prev, [questionId]: 'guiding' }))

      if (!current.guidingUsed) {
        const next: HelpUsageState = {
          ...current,
          guidingUsed: true,
          solutionUnlocked: current.hintShown,
        }
        setHelpUsage((prev) => ({ ...prev, [questionId]: next }))

        systemEventBus.emit(SYSTEM_EVENTS.GUIDING_QUESTION_CLICKED, {
          ...basePayload(questionId),
          guiding_used: true,
        })

        // Dispatch CustomEvent for chat integration
        const question = questionBlocks.find((q) => q.id === questionId)
        if (question) {
          window.dispatchEvent(
            new CustomEvent('exercise-help-action', {
              detail: {
                type: 'guiding',
                questionContent: question.prompt?.value,
                backendContent: question.solution?.value,
                exerciseId,
                lessonId,
              },
            }),
          )
        }

        // Check if solution just became unlocked
        if (next.solutionUnlocked && !unlockEmittedRef.current.has(questionId)) {
          unlockEmittedRef.current.add(questionId)
          systemEventBus.emit(SYSTEM_EVENTS.SOLUTION_UNLOCKED, {
            ...basePayload(questionId),
            hint_used: true,
            guiding_used: true,
          })
        }
      }
    },
    [questionIds, getHelpState, activeHelp, basePayload, questionBlocks, exerciseId, lessonId],
  )

  const handleSolutionClick = useCallback(
    (questionId: string) => {
      if (!questionIds.includes(questionId)) return

      const current = getHelpState(questionId)
      if (!current.solutionUnlocked) return

      const currentActive = activeHelp[questionId]

      // Toggle: if solution is already active, close it
      if (currentActive === 'solution') {
        setActiveHelp((prev) => ({ ...prev, [questionId]: null }))
        return
      }

      setActiveHelp((prev) => ({ ...prev, [questionId]: 'solution' }))

      systemEventBus.emit(SYSTEM_EVENTS.SOLUTION_CLICKED, {
        ...basePayload(questionId),
        hint_used: current.hintShown,
        guiding_used: current.guidingUsed,
      })

      // Dispatch CustomEvent for chat integration
      const question = questionBlocks.find((q) => q.id === questionId)
      if (question) {
        window.dispatchEvent(
          new CustomEvent('exercise-help-action', {
            detail: {
              type: 'solution',
              questionContent: question.prompt?.value,
              backendContent: question.fullSolution?.value,
              exerciseId,
              lessonId,
            },
          }),
        )
      }
    },
    [questionIds, getHelpState, activeHelp, basePayload, questionBlocks, exerciseId, lessonId],
  )

  return {
    helpUsage,
    activeHelp,
    handleHintClick,
    handleGuidingClick,
    handleSolutionClick,
  }
}
