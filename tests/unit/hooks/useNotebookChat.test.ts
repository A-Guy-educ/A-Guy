// @vitest-environment jsdom
import { ChatRole } from '@/infra/llm/chat-message-role'
import { apiService } from '@/server/services/api/api-service'
import { useNotebookChat } from '@/ui/web/chat'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/services/api/api-service', () => ({
  apiService: {
    chat: vi.fn(),
    chatStream: vi.fn(),
    getConversation: vi.fn(),
    resetChat: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const defaultProps = {
  initialMessage: 'Welcome!',
  authRequiredMessage: 'Sign in required',
  errorMessage: 'Something went wrong',
  hintPrompt: 'Hint prompt',
  solutionPrompt: 'Solution prompt',
  fullSolutionPrompt: 'Full solution prompt',
  resetConfirmMessage: 'Confirm reset',
  resetSuccessMessage: 'Reset success',
  resetErrorMessage: 'Reset error',
  acknowledgment: 'Acknowledged',
  exerciseId: 'exercise-1',
  lessonId: 'lesson-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(apiService.getConversation as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    exists: false,
    messages: [],
  })
  ;(apiService.resetChat as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)

  // Default mock for chatStream - successful streaming response
  async function* mockSuccessfulStream(): AsyncGenerator<{ type: string; chunk?: string }> {
    yield { type: 'chunk', chunk: 'A' }
    yield { type: 'chunk', chunk: 'ss' }
    yield { type: 'chunk', chunk: 'istant' }
    yield { type: 'chunk', chunk: ' reply' }
    yield { type: 'done' }
  }
  ;(apiService.chatStream as ReturnType<typeof vi.fn>).mockReturnValue(mockSuccessfulStream())
})

describe('useNotebookChat', () => {
  it('initializes with welcome message and loads history', async () => {
    const { result } = renderHook(() => useNotebookChat(defaultProps))

    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: ChatRole.Assistant, content: defaultProps.initialMessage }),
    ])

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))
    expect(apiService.getConversation).toHaveBeenCalledWith('lessons:lesson-1')
  })

  it('sends messages and appends assistant reply', async () => {
    const { result } = renderHook(() => useNotebookChat(defaultProps))

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    act(() => {
      result.current.setInputValue('Hello')
    })

    await act(async () => {
      result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    expect(apiService.chatStream).toHaveBeenCalledWith(
      'Hello',
      defaultProps.acknowledgment,
      {
        exerciseId: defaultProps.exerciseId,
        lessonId: defaultProps.lessonId,
        chapterId: undefined,
        courseId: undefined,
        categoryId: undefined,
      },
      { contextKeyOverride: undefined },
    )
  })

  it('shows auth error when chat requires authentication', async () => {
    // Create async generator for streaming auth error
    async function* mockAuthErrorStream(): AsyncGenerator<{ type: string; error?: string }> {
      yield { type: 'error', error: 'Unauthorized - authentication required' }
    }
    ;(apiService.chatStream as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockAuthErrorStream())

    const { result } = renderHook(() => useNotebookChat(defaultProps))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    act(() => {
      result.current.setInputValue('Hello')
    })

    await act(async () => {
      result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
    })

    // Auth errors now set chatError state instead of showing toast
    expect(result.current.chatError).toEqual({
      type: 'auth',
      message: defaultProps.authRequiredMessage,
    })
    expect(toast.error).not.toHaveBeenCalled()

    // Test dismissError
    act(() => {
      result.current.dismissError()
    })

    expect(result.current.chatError).toBeNull()
  })

  it('sends quick action prompts', async () => {
    const { result } = renderHook(() => useNotebookChat(defaultProps))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      result.current.handleQuickAction('hint')
    })

    expect(apiService.chat).toHaveBeenCalledWith(
      defaultProps.hintPrompt,
      defaultProps.acknowledgment,
      {
        exerciseId: defaultProps.exerciseId,
        lessonId: defaultProps.lessonId,
        chapterId: undefined,
        courseId: undefined,
        categoryId: undefined,
      },
      undefined,
      undefined, // chatAssetIds
      false, // adminMode
      undefined, // contextKeyOverride
    )
  })

  it('uses categoryId for admin chat context', async () => {
    const adminProps = {
      ...defaultProps,
      categoryId: 'admin',
      exerciseId: undefined,
      lessonId: undefined,
    }
    const { result } = renderHook(() => useNotebookChat(adminProps))

    expect(result.current.contextKey).toBe('categories:admin')

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))
    expect(apiService.getConversation).toHaveBeenCalledWith('categories:admin')
  })

  it('generates correct contextKey for category', () => {
    const adminProps = {
      ...defaultProps,
      categoryId: 'admin-support',
      exerciseId: undefined,
      lessonId: undefined,
    }
    const { result } = renderHook(() => useNotebookChat(adminProps))

    expect(result.current.contextKey).toBe('categories:admin-support')
  })

  it('prioritizes lesson over exercise and category', () => {
    const props = {
      ...defaultProps,
      categoryId: 'admin',
    }
    const { result } = renderHook(() => useNotebookChat(props))

    expect(result.current.contextKey).toBe('lessons:lesson-1')
  })

  it('resets conversation after confirmation', async () => {
    const { result } = renderHook(() => useNotebookChat(defaultProps))
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.handleReset()
    })

    expect(apiService.resetChat).toHaveBeenCalledWith('lessons:lesson-1')
    expect(toast.success).toHaveBeenCalledWith(defaultProps.resetSuccessMessage)
    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: ChatRole.Assistant, content: defaultProps.initialMessage }),
    ])
  })

  it('injectExerciseContext should maintain stable reference across loading state changes', async () => {
    const { result } = renderHook(() => useNotebookChat(defaultProps))

    // Wait for initial load to complete
    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    // Capture the initial injectExerciseContext reference
    const initialInjectExerciseContext = result.current.injectExerciseContext

    // Set input and trigger a loading state change by submitting
    act(() => {
      result.current.setInputValue('Test message')
    })

    // Submit the message - this will change isLoading from false to true, then back to false
    await act(async () => {
      result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
    })

    // Wait for loading to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Verify that injectExerciseContext has the SAME reference (not recreated)
    expect(result.current.injectExerciseContext).toBe(initialInjectExerciseContext)
  })

  describe('error logging', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('logs error to console when streaming fails', async () => {
      // Mock chatStream to throw an error - need to use async generator that throws on iteration
      const streamingError = new Error('Stream connection failed')

      // Create a generator function that throws when iterated
      async function* mockFailingStream(): AsyncGenerator<{ type: string; error?: string }> {
        throw streamingError
      }
      ;(apiService.chatStream as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockFailingStream())

      const { result } = renderHook(() => useNotebookChat(defaultProps))
      await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

      act(() => {
        result.current.setInputValue('Hello')
      })

      await act(async () => {
        result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
      })

      // Wait for the error to be caught
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Verify console.error was called with the expected message and error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Stream message failed:', streamingError)
      // Verify toast is still shown (no regression)
      expect(toast.error).toHaveBeenCalled()
    })

    it('logs error to console when sync message fails', async () => {
      // Mock chat to throw an error
      const syncError = new Error('Sync request failed')
      ;(apiService.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(syncError)

      const adminProps = {
        ...defaultProps,
        adminMode: true, // Force sync path
      }

      const { result } = renderHook(() => useNotebookChat(adminProps))
      await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

      act(() => {
        result.current.setInputValue('Hello')
      })

      await act(async () => {
        result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
      })

      // Wait for the error to be caught
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Verify console.error was called with the expected message and error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Send message sync failed:', syncError)
      // Verify toast is still shown (no regression)
      expect(toast.error).toHaveBeenCalled()
    })

    it('logs error to console when reset fails', async () => {
      // Mock resetChat to throw an error
      const resetError = new Error('Reset failed')
      ;(apiService.resetChat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(resetError)

      const { result } = renderHook(() => useNotebookChat(defaultProps))
      await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

      await act(async () => {
        await result.current.handleReset()
      })

      // Wait for the error to be caught
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Verify console.error was called with the expected message and error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Chat reset failed:', resetError)
      // Verify toast is still shown (no regression)
      expect(toast.error).toHaveBeenCalledWith(defaultProps.resetErrorMessage)
    })
  })
})
