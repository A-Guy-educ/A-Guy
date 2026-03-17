// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceChat } from '@/ui/cody/hooks/useVoiceChat'

let mockRecInstance: { onresult: ((ev: unknown) => void) | null }

function makeSpeechResult(transcript: string): unknown {
  return {
    resultIndex: 0,
    results: {
      length: 1,
      item: () => ({
        isFinal: true,
        length: 1,
        0: { transcript, confidence: 0.9 },
        item: () => ({ transcript, confidence: 0.9 }),
      }),
      0: {
        isFinal: true,
        length: 1,
        0: { transcript, confidence: 0.9 },
        item: () => ({ transcript, confidence: 0.9 }),
      },
    },
  }
}

describe('useVoiceChat', () => {
  beforeEach(() => {
    mockRecInstance = { onresult: null }

    // Mock SpeechSynthesisUtterance
    // @ts-expect-error mocking browser global
    globalThis.SpeechSynthesisUtterance = class {
      text = ''
      lang = ''
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(t: string) {
        this.text = t
      }
    }

    window.SpeechRecognition = class {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 1
      grammars = null
      onstart: ((ev: Event) => void) | null = null
      onend: ((ev: Event) => void) | null = null
      onresult: ((ev: SpeechRecognitionEvent) => void) | null = null
      onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null
      onspeechend = null
      onnomatch = null
      onaudiostart = null
      onaudioend = null
      onsoundstart = null
      onsoundend = null
      start() {
        mockRecInstance.onresult = this.onresult as never
        this.onstart?.(new Event('start'))
      }
      stop() {}
      abort() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() {
        return true
      }
    } as unknown as SpeechRecognitionConstructor

    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(),
        getVoices: () => [],
        paused: false,
        speaking: false,
        pending: false,
        onvoiceschanged: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
    })
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: vi.fn() }))
    expect(result.current.state).toBe('idle')
  })

  it('reports isSupported', () => {
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: vi.fn() }))
    expect(result.current.isSupported).toBe(true)
  })

  it('transitions to listening on startConversation', () => {
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: vi.fn() }))
    act(() => result.current.startConversation())
    expect(result.current.state).toBe('listening')
  })

  it('transitions to idle on stopConversation', () => {
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: vi.fn() }))
    act(() => result.current.startConversation())
    act(() => result.current.stopConversation())
    expect(result.current.state).toBe('idle')
  })

  it('calls onSendMessage when speech recognized', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: onSend }))
    act(() => result.current.startConversation())
    act(() => (mockRecInstance.onresult as (ev: unknown) => void)?.(makeSpeechResult('show tasks')))
    expect(onSend).toHaveBeenCalledWith('show tasks')
    expect(result.current.state).toBe('processing')
  })

  it('detects stop words and ends conversation', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: onSend }))
    act(() => result.current.startConversation())
    act(() => (mockRecInstance.onresult as (ev: unknown) => void)?.(makeSpeechResult('bye')))
    expect(onSend).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })

  it('onResponseComplete transitions to speaking', () => {
    const onSend = vi.fn()
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: onSend }))
    act(() => result.current.startConversation())
    act(() => (mockRecInstance.onresult as (ev: unknown) => void)?.(makeSpeechResult('hello')))
    act(() => result.current.onResponseComplete('Hi there!'))
    expect(result.current.state).toBe('speaking')
    expect(result.current.turnCount).toBe(1)
  })

  it('pauses and resumes', () => {
    const { result } = renderHook(() => useVoiceChat({ onSendMessage: vi.fn() }))
    act(() => result.current.startConversation())
    act(() => result.current.pauseConversation())
    expect(result.current.state).toBe('idle')
    act(() => result.current.resumeConversation())
    expect(result.current.state).toBe('listening')
  })
})
