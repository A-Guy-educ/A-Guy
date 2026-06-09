/**
 * Unit tests for useNotebookChat loading behavior timing
 *
 * Tests the fix for: #1568 - /admin/chat shows 'Loading conversation...'
 * spinner for ~3s after API returns in <100ms
 *
 * The fix removes:
 * 1. minLoadingTime = 100ms artificial delay (line 203 of useNotebookChat.ts)
 * 2. Promise.all forcing both API and minLoadingTime to resolve (line 210)
 *
 * The double requestAnimationFrame pattern (for DOM flush) is kept unchanged.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ChatRole } from '@/infra/llm/chat-message-role'

// Mock requestAnimationFrame to run immediately (not affected by jsdom)
const mockRequestAnimationFrame = vi.fn((cb: (time: number) => void) => {
  cb(0)
  return 0
})
global.requestAnimationFrame = mockRequestAnimationFrame
global.cancelAnimationFrame = vi.fn()

// Mock the logger to avoid console output during tests
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}))

// Mock the apiService
const mockGetConversation = vi.fn()
vi.mock('@/server/services/api/api-service', () => ({
  apiService: {
    getConversation: (...args: unknown[]) => mockGetConversation(...args),
    chat: vi.fn(),
    chatStream: vi.fn(),
    persistMessage: vi.fn(),
    resetChat: vi.fn(),
  },
}))

// Mock useDirectChatAssetUpload
vi.mock('@/ui/web/chat/hooks/useDirectChatAssetUpload', () => ({
  useDirectChatAssetUpload: vi.fn(() => ({
    uploadingFiles: [],
    addFiles: vi.fn(),
    cancelFile: vi.fn(),
    retryFile: vi.fn(),
    removeFile: vi.fn(),
    isUploading: false,
    completedAssetIds: [],
  })),
}))

// Mock system events
vi.mock('@/infra/system-events', () => ({
  SYSTEM_EVENTS: {
    CHAT_MESSAGE_SUBMITTED: 'chat-message-submitted',
    PHOTO_SENT_TO_CHAT: 'photo-sent-to-chat',
  },
  systemEventBus: {
    emit: vi.fn(),
  },
}))

// Mock exercise context formatter
vi.mock('@/infra/llm/exercise-context', () => ({
  formatExerciseContextMessage: vi.fn(() => 'mock exercise context'),
}))

// Mock chat message constants
vi.mock('@/server/chat-assets/constants', () => ({
  IMAGE_REJECTED_TAG: '[IMAGE_REJECTED]',
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('useNotebookChat loading behavior timing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestAnimationFrame.mockImplementation((cb: (time: number) => void) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Bug fix: #1568 Loading spinner disappears immediately after fast API response', () => {
    it('should complete loading without the old artificial delay when API responds instantly', async () => {
      // Setup: API returns instantly with no conversation
      mockGetConversation.mockResolvedValue({
        success: true,
        exists: false,
        messages: [],
        contextKey: 'users:test-user',
      })

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const { useNotebookChat } = await import('@/ui/web/chat/hooks/useNotebookChat')

      const { result } = renderHook(() =>
        useNotebookChat({
          initialMessage: 'Hello!',
          authRequiredMessage: 'Please log in',
          errorMessage: 'An error occurred',
          guestLimitMessage: 'Guest limit reached',
          hintPrompt: 'Need a hint?',
          solutionPrompt: 'Want the solution?',
          fullSolutionPrompt: 'Full solution coming',
          resetConfirmMessage: 'Reset?',
          resetSuccessMessage: 'Chat reset',
          resetErrorMessage: 'Reset failed',
          acknowledgment: 'Got it!',
          adminMode: true,
          userId: 'test-user',
        }),
      )

      expect(result.current.isLoadingHistory).toBe(true)

      await waitFor(
        () => {
          expect(result.current.isLoadingHistory).toBe(false)
        },
        { timeout: 5000 },
      )

      expect(mockGetConversation).toHaveBeenCalledOnce()
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 100)
    })

    it('should transition isLoadingHistory to false when API returns with no conversation', async () => {
      // Setup: API returns with no conversation
      mockGetConversation.mockResolvedValue({
        success: true,
        exists: false,
        messages: [],
        contextKey: 'users:test-user',
      })

      const { useNotebookChat } = await import('@/ui/web/chat/hooks/useNotebookChat')

      const { result } = renderHook(() =>
        useNotebookChat({
          initialMessage: 'Hello!',
          authRequiredMessage: 'Please log in',
          errorMessage: 'An error occurred',
          guestLimitMessage: 'Guest limit reached',
          hintPrompt: 'Need a hint?',
          solutionPrompt: 'Want the solution?',
          fullSolutionPrompt: 'Full solution coming',
          resetConfirmMessage: 'Reset?',
          resetSuccessMessage: 'Chat reset',
          resetErrorMessage: 'Reset failed',
          acknowledgment: 'Got it!',
          adminMode: true,
          userId: 'test-user',
        }),
      )

      expect(result.current.isLoadingHistory).toBe(true)

      await waitFor(
        () => {
          expect(result.current.isLoadingHistory).toBe(false)
        },
        { timeout: 5000 },
      )

      expect(mockGetConversation).toHaveBeenCalledWith('users:test-user')
    })

    it('should transition when conversation exists with messages', async () => {
      mockGetConversation.mockResolvedValue({
        success: true,
        exists: true,
        conversationId: 'conv-123',
        messages: [
          { id: '1', role: ChatRole.User, content: 'Hello' },
          { id: '2', role: ChatRole.Assistant, content: 'Hi there!' },
        ],
        contextKey: 'users:test-user',
      })

      const { useNotebookChat } = await import('@/ui/web/chat/hooks/useNotebookChat')

      const { result } = renderHook(() =>
        useNotebookChat({
          initialMessage: 'Hello!',
          authRequiredMessage: 'Please log in',
          errorMessage: 'An error occurred',
          guestLimitMessage: 'Guest limit reached',
          hintPrompt: 'Need a hint?',
          solutionPrompt: 'Want the solution?',
          fullSolutionPrompt: 'Full solution coming',
          resetConfirmMessage: 'Reset?',
          resetSuccessMessage: 'Chat reset',
          resetErrorMessage: 'Reset failed',
          acknowledgment: 'Got it!',
          adminMode: true,
          userId: 'test-user',
        }),
      )

      await waitFor(
        () => {
          expect(result.current.isLoadingHistory).toBe(false)
        },
        { timeout: 5000 },
      )

      expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    })
  })
})
