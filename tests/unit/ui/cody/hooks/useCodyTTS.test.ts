// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCodyTTS } from '@/ui/cody/hooks/useCodyTTS'

let capturedUtterance: {
  text: string
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
} | null = null

// Mock SpeechSynthesisUtterance (not available in jsdom)
class MockUtterance {
  text: string
  lang = ''
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    capturedUtterance = this
  }
}

describe('useCodyTTS', () => {
  beforeEach(() => {
    capturedUtterance = null
    // @ts-expect-error mocking browser global
    globalThis.SpeechSynthesisUtterance = MockUtterance
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

  it('returns isSupported: true', () => {
    const { result } = renderHook(() => useCodyTTS())
    expect(result.current.isSupported).toBe(true)
  })

  it('speaks text aloud and sets isSpeaking', () => {
    const { result } = renderHook(() => useCodyTTS())
    act(() => result.current.speak('Hello world'))
    expect(window.speechSynthesis.speak).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(true)
  })

  it('strips markdown before speaking', () => {
    const { result } = renderHook(() => useCodyTTS())
    act(() => result.current.speak('This is **bold** and `code`'))
    expect(capturedUtterance).not.toBeNull()
    expect(capturedUtterance!.text).not.toContain('**')
    expect(capturedUtterance!.text).not.toContain('`')
  })

  it('calls onEnd when speech completes', () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useCodyTTS({ onEnd }))
    act(() => result.current.speak('Hello'))
    act(() => capturedUtterance?.onend?.())
    expect(onEnd).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })

  it('detects Hebrew language', () => {
    const { result } = renderHook(() => useCodyTTS())
    act(() => result.current.speak('שלום עולם'))
    expect(capturedUtterance!.lang).toBe('he-IL')
  })

  it('detects English language', () => {
    const { result } = renderHook(() => useCodyTTS())
    act(() => result.current.speak('Hello world, how are you?'))
    expect(capturedUtterance!.lang).toBe('en-US')
  })

  it('fires onEnd for empty text after stripping', () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useCodyTTS({ onEnd }))
    act(() => result.current.speak('```only code```'))
    expect(onEnd).toHaveBeenCalled()
  })

  it('cancels current speech', () => {
    const { result } = renderHook(() => useCodyTTS())
    act(() => result.current.speak('Hello'))
    act(() => result.current.cancel())
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })
})
