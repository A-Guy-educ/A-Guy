'use client'

import { useCallback, useState } from 'react'
import type { SessionState, StepRequest, StepResponse } from '../types'

interface UseInteractiveSessionReturn extends SessionState {
  start: () => Promise<void>
  submitAnswer: (answer: string | { selected: string }) => Promise<void>
  next: () => Promise<void>
  reset: () => Promise<void>
  addClientBlock: (message: string) => void
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
    totalBlocks: 0,
  })

  const callApi = useCallback(async (request: StepRequest): Promise<StepResponse> => {
    const response = await fetch('/api/lessons/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    const json = await response.json()

    if (!response.ok) {
      throw new Error(json?.error?.message || json?.message || 'Failed to process action')
    }

    return (json?.data ?? json) as StepResponse
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
        currentBlockIndex: response.currentBlockIndex,
        currentPhase: response.currentPhase,
        blocks: response.block ? [response.block] : [],
        skillScore: response.skillScore,
        remediation: null,
        isSubmitting: false,
        totalBlocks: response.totalBlocks || 0,
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

        setState((prev) => ({
          ...prev,
          sessionId: response.sessionId,
          currentBlockIndex: response.currentBlockIndex,
          currentPhase: response.currentPhase,
          skillScore: response.skillScore,
          remediation: response.remediation ?? null,
          isCorrect: response.isCorrect,
          isSubmitting: false,
          totalBlocks: response.totalBlocks || prev.totalBlocks,
          // Keep existing blocks, append new block if provided
          blocks: response.block ? [...prev.blocks, response.block] : prev.blocks,
        }))
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

      setState((prev) => ({
        ...prev,
        sessionId: response.sessionId,
        currentBlockIndex: response.currentBlockIndex,
        currentPhase: response.currentPhase,
        skillScore: response.skillScore,
        isSubmitting: false,
        totalBlocks: response.totalBlocks || prev.totalBlocks,
        // Keep existing blocks, append new block if provided
        blocks: response.block ? [...prev.blocks, response.block] : prev.blocks,
        status: response.status,
      }))
    } catch {
      setState((prev) => ({ ...prev, isSubmitting: false, status: 'error' }))
    }
  }, [state, lessonId, callApi])

  const reset = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }))

    try {
      const response = await callApi({
        action: 'reset',
        lessonId,
        sessionId: state.sessionId || undefined,
        clientActionId: crypto.randomUUID(),
      })

      setState({
        sessionId: response.sessionId,
        status: 'active',
        currentBlockIndex: response.currentBlockIndex,
        currentPhase: response.currentPhase,
        blocks: response.block ? [response.block] : [],
        skillScore: response.skillScore,
        remediation: null,
        isSubmitting: false,
        totalBlocks: response.totalBlocks || 0,
      })
    } catch {
      setState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [state, lessonId, callApi])

  const addClientBlock = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      blocks: [
        ...prev.blocks,
        {
          id: crypto.randomUUID(),
          type: 'client_message' as const,
          content: {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: message,
            mediaIds: [],
          },
          role: 'user' as const,
        },
      ],
    }))
  }, [])

  return {
    ...state,
    start,
    submitAnswer,
    next,
    reset,
    addClientBlock,
  }
}
