/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, admin-editor, axis-editor
 * @ai-summary Regression test: AxisEditor must not crash when axis.elements is undefined
 *
 * Bug: When a stored QuestionAxisBlock has axis.elements = undefined (e.g., a block
 * created before the elements field was added), AxisEditor crashes with
 * "TypeError: Cannot read properties of undefined (reading 'elements')" because
 * it accesses spec.elements.graphs.length and similar properties during render without
 * guarding against undefined.
 *
 * Fix: Provide a default elements object so all accesses are safe.
 */
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'

// -------------------------------------------
// Mock all child components of AxisEditor to isolate the test
// -------------------------------------------
vi.mock('@/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor', () => ({
  InlineRichTextEditor: ({ value }: { value: { value?: string } }) => (
    <div data-testid="inline-rich-text">{value?.value ?? ''}</div>
  ),
}))

vi.mock('@/ui/admin/shared/CollapsibleSection', () => ({
  CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="collapsible-section" data-title={title}>
      {children}
    </div>
  ),
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas', () => ({
  AxisCanvas: () => <div data-testid="axis-canvas" />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel', () => ({
  AxisConfigPanel: () => <div data-testid="axis-config-panel" />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/GraphsPanel', () => ({
  GraphsPanel: ({
    graphs,
  }: {
    graphs: Array<{ id: string; fn: string }>
    onChange: (graphs: Array<{ id: string; fn: string }>) => void
  }) => (
    <div data-testid="graphs-panel" data-graphs-count={graphs?.length ?? 0}>
      {(graphs ?? []).map((g) => (
        <span key={g.id}>{g.fn}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/AxisPointsPanel', () => ({
  AxisPointsPanel: ({
    points,
  }: {
    points: Array<{ name: string }>
    onChange: (points: Array<{ name: string }>) => void
  }) => <div data-testid="axis-points-panel" data-points-count={points?.length ?? 0} />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/AsymptotesPanel', () => ({
  AsymptotesPanel: () => <div data-testid="asymptotes-panel" />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/LineBetweenPointsPanel', () => ({
  LineBetweenPointsPanel: () => <div data-testid="line-between-points-panel" />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/PaintPanel', () => ({
  PaintPanel: () => <div data-testid="paint-panel" />,
}))

vi.mock('@/ui/admin/ExerciseContentEditor/components/axis/LociPanel', () => ({
  LociPanel: () => <div data-testid="loci-panel" />,
}))

// -------------------------------------------
// Import the real AxisEditor (all children are mocked)
// -------------------------------------------
import { AxisEditor } from '@/ui/admin/ExerciseContentEditor/editors/AxisEditor'

// -------------------------------------------
// Fixtures
// -------------------------------------------
// Cast through unknown since stored blocks may not match the current TypeScript types
// (legacy data created before schema updates may have incomplete shapes)
const createBlockWithElements = (elements?: {
  points?: Array<{ name: string; x: number; y: number }>
  graphs?: Array<{ id: string; fn: string }>
}): QuestionAxisBlock => {
  const block = {
    id: 'test-axis-1',
    type: 'question_axis' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Test axis',
      mediaIds: [] as string[],
    },
    axis: {
      kind: 'cartesian' as const,
      units: 1,
      grid: { enabled: true, color: '#e0e0e0' },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      elements: elements ?? { points: [], graphs: [] },
    },
  }
  return block as unknown as QuestionAxisBlock
}

const createBlockWithoutElements = (): QuestionAxisBlock => {
  // Cast through unknown: old stored records may be missing the elements field even though
  // the TypeScript type requires it. This is the exact runtime scenario the bug reproduces.
  const block = {
    id: 'test-axis-2',
    type: 'question_axis' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Test axis without elements',
      mediaIds: [] as string[],
    },
    axis: {
      kind: 'cartesian' as const,
      units: 1,
      grid: { enabled: true, color: '#e0e0e0' },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      // Deliberately omit elements — this is what the bug reproduces
    },
  }
  return block as unknown as QuestionAxisBlock
}

// -------------------------------------------
// Tests
// -------------------------------------------
describe('AxisEditor — undefined elements regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT crash when axis.elements is undefined', () => {
    // This is the core repro: a stored axis block missing the elements field
    // must not crash the editor. Before the fix, this throws:
    // TypeError: Cannot read properties of undefined (reading 'elements')
    const block = createBlockWithoutElements()
    const onChange = vi.fn()

    // Should not throw
    expect(() => render(<AxisEditor block={block} onChange={onChange} />)).not.toThrow()
  })

  it('renders GraphsPanel with 0 graphs when elements is undefined', () => {
    const block = createBlockWithoutElements()
    const onChange = vi.fn()

    render(<AxisEditor block={block} onChange={onChange} />)

    // The Graphs collapsible section should show "Graphs (0)" without crashing
    const graphsSection = screen
      .getAllByTestId('collapsible-section')
      .find((s) => s.getAttribute('data-title') === 'Graphs (0)')
    expect(graphsSection).toBeTruthy()
  })

  it('renders PointsPanel with 0 points when elements is undefined', () => {
    const block = createBlockWithoutElements()
    const onChange = vi.fn()

    render(<AxisEditor block={block} onChange={onChange} />)

    // The Points collapsible section should show "Points (0)" without crashing
    const pointsSections = screen.getAllByTestId('collapsible-section')
    const pointsSection = pointsSections.find((s) =>
      s.getAttribute('data-title')?.startsWith('Points'),
    )
    expect(pointsSection).toHaveAttribute('data-title', 'Points (0)')
  })

  it('renders correctly when elements is present with data', () => {
    const block = createBlockWithElements({
      points: [{ name: 'A', x: 1, y: 2 }],
      graphs: [{ id: 'g1', fn: 'x^2' }],
    })
    const onChange = vi.fn()

    render(<AxisEditor block={block} onChange={onChange} />)

    const graphsSection = screen
      .getAllByTestId('collapsible-section')
      .find((s) => s.getAttribute('data-title') === 'Graphs (1)')
    expect(graphsSection).toBeTruthy()
  })

  it('renders with empty elements array when elements is present but empty', () => {
    const block = createBlockWithElements({ points: [], graphs: [] })
    const onChange = vi.fn()

    render(<AxisEditor block={block} onChange={onChange} />)

    const graphsSection = screen
      .getAllByTestId('collapsible-section')
      .find((s) => s.getAttribute('data-title') === 'Graphs (0)')
    expect(graphsSection).toBeTruthy()
  })
})
