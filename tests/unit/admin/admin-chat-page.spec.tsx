/**
 * Unit tests for Issue #2544: Admin chat route renders blank
 *
 * The admin chat page at /admin/chat should display a chat interface with
 * a message input when logged in as an admin. This test verifies that
 * the page renders correctly.
 *
 * Bug: Page renders blank instead of showing ChatInterface
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn((cb: (time: number) => void) => {
  cb(0)
  return 0
})
global.requestAnimationFrame = mockRequestAnimationFrame
global.cancelAnimationFrame = vi.fn()

// Mock logger
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

// Mock apiService
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
    clearCompleted: vi.fn(),
    clearAll: vi.fn(),
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

// Mock useCurrentUser hook
vi.mock('@/client/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' } as any,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

// Mock I18nProvider with real messages
vi.mock('@/ui/web/providers/I18n', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useI18n: () => ({
    locale: 'en',
    messages: {},
    t: (key: string) => key,
  }),
  useTranslations: (namespace?: string) => (key: string) => {
    // Return appropriate translation based on namespace and key
    if (namespace === 'admin.chat') {
      const messages: Record<string, string> = {
        chatWelcome:
          "Hi! I'm your admin AI assistant. Ask me about courses, chapters, lessons, exercises, or media in your system.",
        chatInputPlaceholder: 'Ask a question...',
        chatAuthRequired: 'Please log in to access admin chat',
        openChat: 'Open AI Chat',
        modalTitle: 'Admin AI Assistant',
      }
      return messages[key] || key
    }
    if (namespace === 'courses') {
      // Return the key for courses namespace
      return key
    }
    return key
  },
  useLocale: () => 'en',
}))

// Mock ChatRole - the actual module exports ChatRole enum and ChatMessageRole alias
vi.mock('@/infra/llm/chat-message-role', () => ({
  ChatRole: {
    User: 'user',
    Assistant: 'assistant',
  },
  ChatMessageRole: {
    User: 'user',
    Assistant: 'assistant',
  },
  isChatRole: (value: unknown) =>
    typeof value === 'string' && ['user', 'assistant'].includes(value as string),
  isChatMessageRole: (value: unknown) =>
    typeof value === 'string' && ['user', 'assistant'].includes(value as string),
}))

// Mock TTS hooks
vi.mock('@/ui/web/chat/hooks/useTTS', () => ({
  useTTS: () => ({
    speak: vi.fn(),
    playingMessageId: null,
    pause: vi.fn(),
    resume: vi.fn(),
    setRate: vi.fn(),
    isPaused: false,
    currentRate: 1,
  }),
}))

// Mock useTeacherProfileLabel
vi.mock('@/ui/web/chat/hooks/useTeacherProfileLabel', () => ({
  useTeacherProfileLabel: () => ({
    label: null,
    isLoading: false,
  }),
}))

// Mock useChatQuota
vi.mock('@/ui/web/chat/hooks/useChatQuota', () => ({
  useChatQuota: () => ({
    questionsUsed: 0,
    maxQuestions: 15,
    resetAt: null,
    isLimitReached: false,
    isLoaded: true,
    refreshQuota: vi.fn(),
  }),
}))

// Mock formatMessageTime
vi.mock('@/ui/web/chat/utils/formatMessageTime', () => ({
  formatMessageTime: () => '12:00 PM',
}))

describe('Issue #2544: Admin chat page renders blank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestAnimationFrame.mockImplementation((cb: (time: number) => void) => {
      cb(0)
      return 0
    })
    // Setup: getConversation returns no existing conversation
    mockGetConversation.mockResolvedValue({
      success: true,
      exists: false,
      messages: [],
      contextKey: 'users:test-user-id',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Admin Chat Page Rendering', () => {
    it('should render ChatInterface with admin welcome message', async () => {
      const AdminChatPage = (await import('@/app/(payload)/admin/chat/page')).default
      const { container } = render(<AdminChatPage />)

      // Wait for the page to finish loading
      await waitFor(
        () => {
          // Should show admin welcome message
          expect(container.textContent).toContain("I'm your admin AI assistant")
        },
        { timeout: 5000 },
      )
    })

    it('should render message input', async () => {
      const AdminChatPage = (await import('@/app/(payload)/admin/chat/page')).default
      const { container } = render(<AdminChatPage />)

      await waitFor(
        () => {
          // Should have an input element
          expect(container.querySelector('input')).toBeTruthy()
        },
        { timeout: 5000 },
      )
    })
  })
})
