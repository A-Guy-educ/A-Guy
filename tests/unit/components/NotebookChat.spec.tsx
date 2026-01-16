// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { I18nProvider } from '@/providers/I18n'
import { NotebookChat } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/NotebookChat'
import { useNotebookChat } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/NotebookChat/useNotebookChat'
import enMessages from '../../../messages/en.json'

vi.mock(
  '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/NotebookChat/useNotebookChat',
  () => ({
    useNotebookChat: vi.fn(),
  }),
)

const mockUseNotebookChat = vi.mocked(useNotebookChat)

type NotebookChatHookState = {
  messages: Array<{ role: string; content: string }>
  inputValue: string
  isLoading: boolean
  isLoadingHistory: boolean
  messagesContainerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  inputRef: React.RefObject<HTMLInputElement>
  contextKey: string | null
  setInputValue: (value: string) => void
  handleSubmit: (e: React.FormEvent) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleQuickAction: (action: 'hint' | 'solution' | 'full') => void
  handleReset: () => void
}

const renderWithI18n = (hookState: NotebookChatHookState) => {
  mockUseNotebookChat.mockReturnValue(hookState as ReturnType<typeof useNotebookChat>)

  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <NotebookChat exerciseId="exercise-1" />
    </I18nProvider>,
  )
}

const baseHookState = {
  messages: [{ role: 'assistant', content: 'Welcome message' }],
  inputValue: 'Hello',
  isLoading: false,
  isLoadingHistory: false,
  messagesContainerRef: React.createRef<HTMLDivElement>(),
  messagesEndRef: React.createRef<HTMLDivElement>(),
  inputRef: React.createRef<HTMLInputElement>(),
  contextKey: 'exercises:exercise-1',
  setInputValue: vi.fn(),
  handleSubmit: vi.fn(),
  handleKeyDown: vi.fn(),
  handleQuickAction: vi.fn(),
  handleReset: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotebookChat component', () => {
  it('renders messages and header text', () => {
    renderWithI18n(baseHookState)

    expect(screen.getByText(enMessages.courses.chatTitle)).toBeTruthy()
    expect(screen.getByText('Welcome message')).toBeTruthy()
  })

  it('shows loading history state', () => {
    renderWithI18n({ ...baseHookState, isLoadingHistory: true })
    expect(screen.getByText(enMessages.courses.chatLoadingHistory)).toBeTruthy()
  })

  it('disables send button when input is empty', () => {
    renderWithI18n({ ...baseHookState, inputValue: '' })
    const sendButton = screen.getByLabelText(enMessages.courses.sendMessage)
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('invokes quick action handlers', () => {
    renderWithI18n(baseHookState)

    fireEvent.click(screen.getByText(enMessages.courses.chatHint))
    expect(baseHookState.handleQuickAction).toHaveBeenCalledWith('hint')
  })

  it('invokes reset handler when reset is clicked', () => {
    renderWithI18n(baseHookState)

    fireEvent.click(screen.getByText(enMessages.courses.chatReset))
    expect(baseHookState.handleReset).toHaveBeenCalled()
  })
})
