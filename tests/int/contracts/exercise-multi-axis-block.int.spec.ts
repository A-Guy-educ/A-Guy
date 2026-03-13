import { ContentBlockSchema } from '@/server/payload/collections/Exercises/schemas'
import { describe, expect, it } from 'vitest'

// Helper to create a valid axis spec (minimal valid structure)
const createValidAxisSpec = () => ({
  kind: 'cartesian',
  units: 10,
  grid: { enabled: true },
  axes: {
    showNumbers: true,
    showLabels: true,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
  },
  elements: { points: [], graphs: [], asymptotesVertical: [], asymptotesHorizontal: [] },
})

describe('QuestionMultiAxisBlockSchema', () => {
  it('validates a multi-axis block with 2 graphs', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Compare the two functions:',
      },
      textPosition: 'above',
      graphs: [
        { id: 'g1', label: 'גרף 1', axis: createValidAxisSpec(), order: 1 },
        { id: 'g2', label: 'גרף 2', axis: createValidAxisSpec(), order: 2 },
      ],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).not.toThrow()
  })

  it('rejects multi-axis block with 5 graphs (max 4)', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      graphs: [
        { id: 'g1', label: 'גרף 1', axis: createValidAxisSpec(), order: 1 },
        { id: 'g2', label: 'גרף 2', axis: createValidAxisSpec(), order: 2 },
        { id: 'g3', label: 'גרף 3', axis: createValidAxisSpec(), order: 3 },
        { id: 'g4', label: 'גרף 4', axis: createValidAxisSpec(), order: 4 },
        { id: 'g5', label: 'גרף 5', axis: createValidAxisSpec(), order: 5 },
      ],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).toThrow()
  })

  it('rejects multi-axis block with 0 graphs (min 1)', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      graphs: [],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).toThrow()
  })

  it('rejects multi-axis block with duplicate graph IDs', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      graphs: [
        { id: 'g1', label: 'גרף 1', axis: createValidAxisSpec(), order: 1 },
        { id: 'g1', label: 'גרף 2', axis: createValidAxisSpec(), order: 2 },
      ],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).toThrow()
  })

  it('rejects multi-axis block with missing label', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      graphs: [{ id: 'g1', label: '', axis: createValidAxisSpec(), order: 1 }],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).toThrow()
  })

  it('validates multi-axis block with textPosition=below', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      textPosition: 'below',
      graphs: [{ id: 'g1', label: 'גרף 1', axis: createValidAxisSpec(), order: 1 }],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).not.toThrow()
  })

  it('validates single graph without prompt', () => {
    const multiAxisBlock = {
      id: 'ma1',
      type: 'question_multi_axis',
      graphs: [{ id: 'g1', label: 'גרף 1', axis: createValidAxisSpec(), order: 1 }],
    }
    expect(() => ContentBlockSchema.parse(multiAxisBlock)).not.toThrow()
  })

  it('existing question_axis block still validates (no breaking change)', () => {
    const axisBlock = {
      id: 'a1',
      type: 'question_axis',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Plot:' },
      axis: createValidAxisSpec(),
    }
    expect(() => ContentBlockSchema.parse(axisBlock)).not.toThrow()
  })
})
