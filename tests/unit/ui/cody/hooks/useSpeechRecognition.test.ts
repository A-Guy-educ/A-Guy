// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '@/ui/cody/hooks/useSpeechRecognition'

// Vitest 4 requires function/class for constructor mocks
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 1
  grammars: unknown = null
  onstart: ((ev: Event) => void) | null = null
  onend: ((ev: Event) => void) | null = null
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null
  onspeechend: ((ev: Event) => void) | null = null
  onnomatch: ((ev: Event) => void) | null = null
  onaudiostart: ((ev: Event) => void) | null = null
  onaudioend: ((ev: Event) => void) | null = null
  onsoundstart: ((ev: Event) => void) | null = null
  onsoundend: ((ev: Event) => void) | null = null
  start() {
    this.onstart?.(new Event('start'))
  }
  stop() {
    /* noop — tests call onend manually */
  }
  abort() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true
  }
}

let mockInstance: MockSpeechRecognition

function makeSpeechResult(transcript: string, isFinal: boolean): SpeechRecognitionEvent {
  return {
    resultIndex: 0,
    results: {
      length: 1,
      item: () => ({
        isFinal,
        length: 1,
        0: { transcript, confidence: 0.9 },
        item: () => ({ transcript, confidence: 0.9 }),
      }),
      0: {
        isFinal,
        length: 1,
        0: { transcript, confidence: 0.9 },
        item: () => ({ transcript, confidence: 0.9 }),
      },
    },
  } as unknown as SpeechRecognitionEvent
}

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    // Use a real class constructor so Vitest 4 is happy
    window.SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockInstance = this
      }
    } as unknown as SpeechRecognitionConstructor
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition
  })

  it('returns isSupported: true when API is available', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isSupported).toBe(true)
  })

  it('returns isSupported: false when API is unavailable', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isSupported).toBe(false)
  })

  it('starts listening when start() is called', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.start())
    expect(result.current.isListening).toBe(true)
  })

  it('calls onResult with final transcript', () => {
    const onResult = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onResult }))
    act(() => result.current.start())
    act(() => mockInstance.onresult?.(makeSpeechResult('hello world', true)))
    expect(onResult).toHaveBeenCalledWith('hello world')
    expect(result.current.finalTranscript).toBe('hello world')
  })

  it('updates interim transcript', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => result.current.start())
    act(() => mockInstance.onresult?.(makeSpeechResult('hel', false)))
    expect(result.current.transcript).toBe('hel')
  })

  it('calls onError for not-allowed', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onError }))
    act(() => result.current.start())
    act(() =>
      mockInstance.onerror?.({
        error: 'not-allowed',
        message: '',
      } as unknown as SpeechRecognitionErrorEvent),
    )
    expect(onError).toHaveBeenCalled()
    expect(result.current.error).toContain('Microphone access was denied')
  })

  it('ignores no-speech errors', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onError }))
    act(() => result.current.start())
    act(() =>
      mockInstance.onerror?.({
        error: 'no-speech',
        message: '',
      } as unknown as SpeechRecognitionErrorEvent),
    )
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })
})
