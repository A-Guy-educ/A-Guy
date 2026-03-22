// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playNotificationSound } from '@/ui/cody/notifications/sounds'

describe('playNotificationSound', () => {
  let mockOsc: {
    connect: ReturnType<typeof vi.fn>
    frequency: { value: number }
    type: string
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }
  let mockGain: {
    connect: ReturnType<typeof vi.fn>
    gain: {
      value: number
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
    }
  }

  beforeEach(() => {
    mockOsc = { connect: vi.fn(), frequency: { value: 0 }, type: '', start: vi.fn(), stop: vi.fn() }
    mockGain = {
      connect: vi.fn(),
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    }

    // @ts-expect-error mocking AudioContext
    window.AudioContext = class {
      currentTime = 0
      destination = {}
      createOscillator() {
        return mockOsc
      }
      createGain() {
        return mockGain
      }
    }
  })

  it('plays a high priority sound (double beep)', () => {
    playNotificationSound('high')
    // Two beeps — oscillator started twice
    expect(mockOsc.start).toHaveBeenCalledTimes(2)
    expect(mockOsc.stop).toHaveBeenCalledTimes(2)
  })

  it('plays a medium priority sound (single chime)', () => {
    playNotificationSound('medium')
    expect(mockOsc.start).toHaveBeenCalledTimes(1)
    expect(mockOsc.stop).toHaveBeenCalledTimes(1)
  })

  it('plays a low priority sound (subtle tick)', () => {
    playNotificationSound('low')
    expect(mockOsc.start).toHaveBeenCalledTimes(1)
  })

  it('does not throw when AudioContext is missing', () => {
    // @ts-expect-error removing mock
    delete window.AudioContext
    expect(() => playNotificationSound('high')).not.toThrow()
  })
})
