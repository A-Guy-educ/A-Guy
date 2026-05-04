/**
 * @fileType unit-test
 * @domain exercises
 * @pattern schema-validation, label-size
 * @ai-summary Unit tests for labelSize field in QuestionGeometryBlock and QuestionAxisBlock schema and defaults
 */
import { describe, expect, it } from 'vitest'

import {
  QuestionGeometryBlockSchema,
  QuestionAxisBlockSchema,
  ContentBlockSchema,
} from '@/server/payload/collections/Exercises/schemas'
import type {
  QuestionGeometryBlock,
  QuestionAxisBlock,
} from '@/server/payload/collections/Exercises/types'
import { ExerciseBlockDefaults } from '@/server/payload/collections/Exercises/defaults'

// Valid geometry block base for testing
const validGeometryBlockBase = {
  id: 'geo-1',
  type: 'question_geometry' as const,
  prompt: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Find the angle',
    mediaIds: [],
  },
  geometry: {
    kind: 'euclidean' as const,
    canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
    elements: {
      points: [{ name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' }],
      lines: [],
      circles: [],
      angles: [],
    },
    interactionSpec: { enabled: false, toolsAllowed: [], evaluation: { mode: 'none' } },
  },
}

// Valid axis block base for testing
const validAxisBlockBase = {
  id: 'axis-1',
  type: 'question_axis' as const,
  prompt: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Graph the function:',
    mediaIds: [],
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
    elements: { points: [], graphs: [] },
  },
}

describe('QuestionGeometryBlockSchema — labelSize field', () => {
  it('accepts labelSize: default', () => {
    const block = { ...validGeometryBlockBase, labelSize: 'default' }
    expect(() => QuestionGeometryBlockSchema.parse(block)).not.toThrow()
  })

  it('accepts labelSize: small', () => {
    const block = { ...validGeometryBlockBase, labelSize: 'small' }
    expect(() => QuestionGeometryBlockSchema.parse(block)).not.toThrow()
  })

  it('accepts labelSize omitted (optional)', () => {
    const block = { ...validGeometryBlockBase }
    expect(() => QuestionGeometryBlockSchema.parse(block)).not.toThrow()
  })

  it('rejects invalid labelSize value', () => {
    const block = { ...validGeometryBlockBase, labelSize: 'tiny' }
    expect(() => QuestionGeometryBlockSchema.parse(block)).toThrow()
  })
})

describe('QuestionAxisBlockSchema — labelSize field', () => {
  it('accepts labelSize: default', () => {
    const block = { ...validAxisBlockBase, labelSize: 'default' }
    expect(() => QuestionAxisBlockSchema.parse(block)).not.toThrow()
  })

  it('accepts labelSize: small', () => {
    const block = { ...validAxisBlockBase, labelSize: 'small' }
    expect(() => QuestionAxisBlockSchema.parse(block)).not.toThrow()
  })

  it('accepts labelSize omitted (optional)', () => {
    const block = { ...validAxisBlockBase }
    expect(() => QuestionAxisBlockSchema.parse(block)).not.toThrow()
  })

  it('rejects invalid labelSize value', () => {
    const block = { ...validAxisBlockBase, labelSize: 'medium' }
    expect(() => QuestionAxisBlockSchema.parse(block)).toThrow()
  })
})

describe('ContentBlockSchema — labelSize on geometry and axis blocks', () => {
  it('accepts geometry block with labelSize: small', () => {
    const block = { ...validGeometryBlockBase, labelSize: 'small' }
    expect(() => ContentBlockSchema.parse(block)).not.toThrow()
  })

  it('accepts axis block with labelSize: small', () => {
    const block = { ...validAxisBlockBase, labelSize: 'small' }
    expect(() => ContentBlockSchema.parse(block)).not.toThrow()
  })
})

describe('ExerciseBlockDefaults — labelSize default value', () => {
  it('question_geometry defaults to labelSize: default', () => {
    const block = ExerciseBlockDefaults['question_geometry']()
    expect((block as QuestionGeometryBlock).labelSize).toBe('default')
  })

  it('question_axis defaults to labelSize: default', () => {
    const block = ExerciseBlockDefaults['question_axis']()
    expect((block as QuestionAxisBlock).labelSize).toBe('default')
  })
})
