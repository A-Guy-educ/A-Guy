'use client'

import { useCallback, useState } from 'react'
import type { SessionState, StepRequest, StepResponse } from '../types'

interface UseInteractiveSessionReturn extends SessionState {
  start: () => Promise<void>
  submitAnswer: (answer: string | { selected: string }) => Promise<void>
  next: () => Promise<void>
  reset: () => Promise<void>
}

export function useInteractiveSession(
  lessonId: string,
  _lessonTitle: string,
): UseInteractiveSessionReturn {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    status: 'idle',
    currentBlockIndex: 0,
    currentPhase: null,
    blocks: [],
    skillScore: 0,
    remediation: null,
    isSubmitting: false,
  })

  const callApi = useCallback(async (request: StepRequest): Promise<StepResponse> => {
    const response = await fetch('/api/lessons/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to process action')
    }

    return response.json()
  }, [])

  const start = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }))

    try {
      const response = await callApi({
        action: 'start',
        lessonId,
        clientActionId: crypto.randomUUID(),
      })

      setState({
        sessionId: response.sessionId,
        status: 'active',
        currentBlockIndex: 0,
        currentPhase: response.currentPhase,
        blocks: response.currentBlock ? [response.currentBlock] : [],
        skillScore: response.skillScore,
        remediation: null,
        isSubmitting: false,
      })
    } catch {
      setState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [lessonId, callApi])

  const submitAnswer = useCallback(
    async (answer: string | { selected: string }) => {
      if (!state.sessionId) return

      setState((prev) => ({ ...prev, isSubmitting: true }))

      try {
        const response = await callApi({
          action: 'answer',
          lessonId,
          sessionId: state.sessionId,
          clientActionId: crypto.randomUUID(),
          answer,
        })

        setState({
          ...state,
          sessionId: response.sessionId,
          currentPhase: response.currentPhase,
          skillScore: response.skillScore,
          remediation: response.remediation ?? null,
          isCorrect: response.isCorrect,
          isSubmitting: false,
          // Keep existing blocks, append new block if provided
          blocks: response.currentBlock ? [...state.blocks, response.currentBlock] : state.blocks,
          currentBlockIndex: response.currentBlock ? state.blocks.length : state.currentBlockIndex,
        })
      } catch {
        setState((prev) => ({ ...prev, isSubmitting: false, status: 'error' }))
      }
    },
    [state, lessonId, callApi],
  )

  const next = useCallback(async () => {
    if (!state.sessionId) return

    setState((prev) => ({ ...prev, isSubmitting: true }))

    try {
      const response = await callApi({
        action: 'next',
        lessonId,
        sessionId: state.sessionId,
        clientActionId: crypto.randomUUID(),
      })

      setState({
        ...state,
        sessionId: response.sessionId,
        currentPhase: response.currentPhase,
        skillScore: response.skillScore,
        isSubmitting: false,
        // Keep existing blocks, append new block if provided
        blocks: response.currentBlock ? [...state.blocks, response.currentBlock] : state.blocks,
        currentBlockIndex: response.currentBlock ? state.blocks.length : state.currentBlockIndex,
        status: response.completed ? 'completed' : 'active',
      })
    } catch {
      setState((prev) => ({ ...prev, isSubmitting: false, status: 'error' }))
    }
  }, [state, lessonId, callApi])

  const reset = useCallback(async () => {
    if (!state.sessionId) return

    setState((prev) => ({ ...prev, status: 'loading' }))

    try {
      const response = await callApi({
        action: 'reset',
        lessonId,
        sessionId: state.sessionId,
        clientActionId: crypto.randomUUID(),
      })

      setState({
        sessionId: response.sessionId,
        status: 'active',
        currentBlockIndex: 0,
        currentPhase: response.currentPhase,
        blocks: response.currentBlock ? [response.currentBlock] : [],
        skillScore: response.skillScore,
        remediation: null,
        isSubmitting: false,
      })
    } catch {
      setState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [state, lessonId, callApi])

  return {
    ...state,
    start,
    submitAnswer,
    next,
    reset,
  }
}
