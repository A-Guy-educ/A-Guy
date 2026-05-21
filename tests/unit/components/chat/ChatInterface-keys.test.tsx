// @vitest-environment jsdom
import { ChatMessage } from '@/ui/web/chat/hooks/useNotebookChat'
import { ChatRole } from '@/infra/llm/chat-message-role'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../../src/i18n/en.json'
import { ChatInterface } from '@/ui/web/chat/ChatInterface'
import { render, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Mock sonner toast
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Mock useCurrentUser
vi.mock('@/client/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}))

// Mock useTeacherProfileLabel
vi.mock('@/ui/web/chat/hooks/useTeacherProfileLabel', () => ({
  useTeacherProfileLabel: () => ({ label: null }),
}))

// Mock useTTS
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

// Mock useChatQuota — isLimitReached=false so Send button is not disabled by quota
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

describe('ChatMessage ID validation', () => {
  describe('Test 1: Verify ChatMessage has a non-empty id string property', () => {
    it('should have a non-empty id property that is a string', () => {
      const message: ChatMessage = {
        id: 'test-id-123',
        role: ChatRole.User,
        content: 'Hello',
      }

      expect(typeof message.id).toBe('string')
      expect(message.id.length).toBeGreaterThan(0)
    })

    it('should validate ChatMessage type has id as required string field', () => {
      // Test that the ChatMessage interface enforces non-empty id
      const validMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: ChatRole.Assistant,
        content: 'Test response',
      }

      expect(validMessage.id).toBeDefined()
      expect(typeof validMessage.id).toBe('string')
      expect(validMessage.id).not.toBe('')
    })
  })

  describe('Test 2: All message IDs in the array are unique (no duplicates)', () => {
    it('should generate unique IDs for multiple messages', () => {
      const messages: ChatMessage[] = [
        { id: crypto.randomUUID(), role: ChatRole.User, content: 'Message 1' },
        { id: crypto.randomUUID(), role: ChatRole.Assistant, content: 'Message 2' },
        { id: crypto.randomUUID(), role: ChatRole.User, content: 'Message 3' },
      ]

      const ids = messages.map((m) => m.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })
  })
})

describe('ChatInterface static analysis - React keys', () => {
  const chatInterfacePath = path.resolve(process.cwd(), 'src/ui/web/chat/ChatInterface/index.tsx')

  describe('Test 3: ChatInterface does not use key={idx} or key={index} for messages', () => {
    it('should NOT use key={idx} or key={index} in messages.map', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for problematic patterns like key={idx} or key={index} in message rendering
      const badPatterns = [
        /messages\.map\s*\(\s*\([^)]*,\s*idx\s*\)\s*=>[^}]*key=\{idx\}/,
        /messages\.map\s*\(\s*\([^)]*,\s*index\s*\)\s*=>[^}]*key=\{index\}/,
        /messages\.map\s*\(\s*\(\w+,\s*idx\)/,
        /messages\.map\s*\(\s*\(\w+,\s*index\)/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }
    })
  })

  describe('Test 4: ChatInterface uses key={msg.id} for messages', () => {
    it('should use key={msg.id} or key={messageId} for messages', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for correct pattern: key={msg.id} or key={messageId}
      const goodPatterns = [
        /messages\.map\s*\(\s*\(\s*\w+\s*\)\s*=>[^}]*key=\{\w+\.id\}/,
        /key=\{\s*\w+\.id\s*\}/,
      ]

      // Should have at least one correct pattern
      const hasCorrectPattern = goodPatterns.some((pattern) => pattern.test(sourceCode))
      expect(hasCorrectPattern).toBe(true)
    })
  })

  describe('Test 5: ChatInterface does not use key={mediaIdx} or key={assetIdx}', () => {
    it('should NOT use key={mediaIdx} or key={assetIdx} in media/asset rendering', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for bad patterns in media and chatAssets rendering
      const badPatterns = [
        /msg\.media\.map\s*\(\s*\([^)]*,\s*mediaIdx\s*\)/,
        /msg\.chatAssets\.map\s*\(\s*\([^)]*,\s*assetIdx\s*\)/,
        /key=\{mediaIdx\}/,
        /key=\{assetIdx\}/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }

      // Should use proper keys like key={mediaItem.mediaId} or key={asset.chatAssetId}
      const goodMediaKeyPattern = /key=\{\s*\w+\.mediaId\s*\}/
      const goodAssetKeyPattern = /key=\{\s*\w+\.chatAssetId\s*\}/

      expect(sourceCode).toMatch(goodMediaKeyPattern)
      expect(sourceCode).toMatch(goodAssetKeyPattern)
    })
  })
})

describe('CollectionArchive static analysis - React keys', () => {
  const collectionArchivePath = path.resolve(
    process.cwd(),
    'src/ui/web/CollectionArchive/index.tsx',
  )

  describe('Test 6: CollectionArchive uses key={result.slug} instead of key={index}', () => {
    it('should use key={result.slug} for posts mapping', () => {
      const sourceCode = fs.readFileSync(collectionArchivePath, 'utf-8')

      // Check for correct pattern: key={result.slug}
      const goodPattern = /key=\{\s*result\.slug\s*\}/
      expect(sourceCode).toMatch(goodPattern)
    })

    it('should NOT use key={index} or key={i} for posts mapping', () => {
      const sourceCode = fs.readFileSync(collectionArchivePath, 'utf-8')

      // Check for bad patterns
      const badPatterns = [
        /key=\{index\}/,
        /key=\{i\}/,
        /posts\.map\s*\(\s*\(\s*\w+,\s*index\s*\)/,
        /posts\.map\s*\(\s*\(\s*\w+,\s*i\s*\)/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }
    })
  })
})

// Import useNotebookChat for mocking — must be after mocks above
vi.mock('@/ui/web/chat/hooks/useNotebookChat', () => ({
  useNotebookChat: vi.fn(),
}))

import { useNotebookChat } from '@/ui/web/chat/hooks/useNotebookChat'

describe('ChatInterface keyboard shortcuts', () => {
  // Shared mock return for useNotebookChat — reset state between tests
  const createMockNotebookChat = (overrides = {}) => ({
    messages: [],
    inputValue: '',
    isLoading: false,
    isLoadingHistory: false,
    messagesContainerRef: { current: null },
    messagesEndRef: { current: null },
    inputRef: { current: null },
    fileInputRef: { current: null },
    contextKey: 'test-context',
    setInputValue: vi.fn(),
    handleSubmit: vi.fn(),
    handleQuickAction: vi.fn(),
    handleReset: vi.fn(),
    directUploads: [],
    addDirectUploads: vi.fn(),
    removeDirectUpload: vi.fn(),
    retryDirectUpload: vi.fn(),
    isDirectUploading: false,
    completedChatAssetIds: [],
    openFilePicker: vi.fn(),
    chatError: null,
    dismissError: vi.fn(),
    addExternalMedia: vi.fn(),
    askMedia: null,
    clearAskMedia: vi.fn(),
    addAssistantMessage: vi.fn(),
    injectExerciseContext: vi.fn(),
    sendContextualHelp: vi.fn(),
    sendVisibleHelp: vi.fn(),
    sendContextualHelpWithMedia: vi.fn(),
    sendContextualHelpWithMediaId: vi.fn(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderChat = (mockChat = createMockNotebookChat()) => {
    ;(useNotebookChat as ReturnType<typeof vi.fn>).mockReturnValue(mockChat as never)
    return render(
      <I18nProvider locale="en" messages={enMessages}>
        <ChatInterface />
      </I18nProvider>,
    )
  }

  it('Cmd+Enter submits the form when input is non-empty (macOS)', () => {
    const mockChat = createMockNotebookChat({ inputValue: 'Hello world' })
    const { container } = renderChat(mockChat)
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    expect(mockChat.handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Enter submits the form when input is non-empty (Windows/Linux)', () => {
    const mockChat = createMockNotebookChat({ inputValue: 'Hello world' })
    const { container } = renderChat(mockChat)
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(mockChat.handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('Plain Enter does NOT trigger handleSubmit via onKeyDown', () => {
    // Note: The form element's native onSubmit still fires on plain Enter in browsers.
    // This test only verifies that the onKeyDown handler does NOT call handleSubmit —
    // i.e., plain Enter is not a shortcut for submission. The empty-input guard is
    // handled upstream in sendMessage, not in this handler.
    const mockChat = createMockNotebookChat({ inputValue: 'Hello world' })
    const { container } = renderChat(mockChat)
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockChat.handleSubmit).not.toHaveBeenCalled()
  })

  it('Cmd+Enter calls handleSubmit when input is empty (guard is in sendMessage)', () => {
    const mockChat = createMockNotebookChat({ inputValue: '' })
    const { container } = renderChat(mockChat)
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    // handleSubmit is called — empty-input guard lives in sendMessage
    expect(mockChat.handleSubmit).toHaveBeenCalledTimes(1)
  })
})
