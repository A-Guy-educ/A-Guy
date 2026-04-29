/**
 * Pins pickSceneKind's priority order and the multi-populated warning.
 *
 * The schema lets the model populate more than one scene kind, but the
 * renderer only shows one. Without these tests, a future "let me reorder
 * the priority" or "let me drop the warning" change can silently change
 * which scene students see.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { pickSceneKind } from '@/infra/llm/services/interactive-lesson/lesson-to-guided-explanation'
import type { InteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

const baseGeometry = {
  width: 400,
  height: 300,
  points: [],
  segments: [],
  angles: [],
  labels: [],
}

function lesson(overrides: Partial<InteractiveLesson>): InteractiveLesson {
  return {
    title: 't',
    locale: 'en',
    steps: [],
    geometry: baseGeometry,
    ...overrides,
  }
}

describe('pickSceneKind', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns "graph" when graph has plots', () => {
    const out = pickSceneKind(
      lesson({
        graph: {
          xRange: [-1, 1],
          yRange: [-1, 1],
          plots: [
            {
              id: 'f',
              points: [
                [0, 0],
                [1, 1],
              ],
            },
          ],
          markers: [],
        },
      }),
    )
    expect(out).toBe('graph')
  })

  it('returns "graph" when graph has only markers (no plots)', () => {
    // Marker-only graphs are valid for "find the intersections" problems.
    const out = pickSceneKind(
      lesson({
        graph: {
          xRange: [-5, 5],
          yRange: [-5, 5],
          plots: [],
          markers: [{ id: 'm1', x: 1, y: 2 }],
        },
      }),
    )
    expect(out).toBe('graph')
  })

  it('returns "numberLine" when only numberLine has marks', () => {
    const out = pickSceneKind(
      lesson({
        numberLine: { range: [-3, 3], marks: [{ id: 'a', value: 0 }], intervals: [] },
      }),
    )
    expect(out).toBe('numberLine')
  })

  it('returns "numberLine" when only numberLine has intervals', () => {
    const out = pickSceneKind(
      lesson({
        numberLine: {
          range: [-3, 3],
          marks: [],
          intervals: [{ id: 'i', from: 0, to: 2, fromInclusion: 'closed', toInclusion: 'open' }],
        },
      }),
    )
    expect(out).toBe('numberLine')
  })

  it('returns "geometry" when only geometry has segments', () => {
    const out = pickSceneKind(
      lesson({
        geometry: { ...baseGeometry, segments: [{ from: 'A', to: 'B' }] },
      }),
    )
    expect(out).toBe('geometry')
  })

  it('returns "geometry" when only geometry has points', () => {
    const out = pickSceneKind(
      lesson({
        geometry: { ...baseGeometry, points: [{ label: 'A', x: 0, y: 0 }] },
      }),
    )
    expect(out).toBe('geometry')
  })

  it('falls back to "equation" when nothing is populated', () => {
    expect(pickSceneKind(lesson({}))).toBe('equation')
  })

  it('priority is graph > numberLine > geometry > equation', () => {
    const everything = lesson({
      geometry: { ...baseGeometry, segments: [{ from: 'A', to: 'B' }] },
      graph: {
        xRange: [-1, 1],
        yRange: [-1, 1],
        plots: [
          {
            id: 'f',
            points: [
              [0, 0],
              [1, 1],
            ],
          },
        ],
        markers: [],
      },
      numberLine: {
        range: [-1, 1],
        marks: [{ id: 'm', value: 0 }],
        intervals: [],
      },
    })
    expect(pickSceneKind(everything)).toBe('graph')

    const noGraph = lesson({
      geometry: { ...baseGeometry, segments: [{ from: 'A', to: 'B' }] },
      numberLine: {
        range: [-1, 1],
        marks: [{ id: 'm', value: 0 }],
        intervals: [],
      },
    })
    expect(pickSceneKind(noGraph)).toBe('numberLine')
  })

  it('logs a warning when more than one scene kind is populated', () => {
    pickSceneKind(
      lesson({
        geometry: { ...baseGeometry, points: [{ label: 'A', x: 0, y: 0 }] },
        graph: {
          xRange: [-1, 1],
          yRange: [-1, 1],
          plots: [
            {
              id: 'f',
              points: [
                [0, 0],
                [1, 1],
              ],
            },
          ],
          markers: [],
        },
      }),
    )
    expect(warnSpy).toHaveBeenCalled()
    const message = warnSpy.mock.calls[0][0] as string
    expect(message).toContain('Multiple scene kinds populated')
  })

  it('does NOT warn when only one scene kind is populated', () => {
    pickSceneKind(
      lesson({
        graph: {
          xRange: [-1, 1],
          yRange: [-1, 1],
          plots: [
            {
              id: 'f',
              points: [
                [0, 0],
                [1, 1],
              ],
            },
          ],
          markers: [],
        },
      }),
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
