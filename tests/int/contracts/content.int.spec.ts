import { describe, expect, it } from 'vitest'
import { ExerciseContentSchema } from '@/contracts'

describe('ExerciseContentSchema', () => {
  it('validates exercise content with mixed blocks', () => {
    const validContent = {
      stem: [
        {
          id: 'b1',
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Solve: $2x^2+3=11$',
        },
        {
          id: 'b2',
          type: 'axis_system',
          specVersion: 1,
          spec: {
            kind: 'cartesian',
            units: 1,
            grid: { enabled: true },
            axes: {
              showNumbers: true,
              showLabels: true,
              ticks: 1,
              labels: { x: 'x', y: 'y' },
              origin: { x: 0, y: 0 },
            },
            elements: {
              points: [],
              graphs: [
                {
                  id: 'g1',
                  fn: '2*x^2+3',
                  style: 'solid',
                  thickness: 1,
                },
              ],
            },
            interactionSpec: {
              enabled: false,
              toolsAllowed: [],
              evaluation: { mode: 'none' },
            },
          },
        },
      ],
      sections: [
        {
          id: 's1',
          label: 'A',
          prompt: [
            {
              id: 'b3',
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Select the correct value of $x$.',
            },
          ],
          subSections: [],
        },
      ],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })

  it('validates exercise content with nested subsections', () => {
    const validContent = {
      stem: [{ id: 'b1', type: 'rich_text', format: 'md-math-v1', value: 'Main question' }],
      sections: [
        {
          id: 's1',
          label: '1',
          prompt: [{ id: 'b2', type: 'rich_text', format: 'md-math-v1', value: 'Part 1' }],
          subSections: [
            {
              id: 's1a',
              label: 'a',
              prompt: [
                {
                  id: 'b3',
                  type: 'rich_text',
                  format: 'md-math-v1',
                  value: 'Subpart a',
                },
              ],
            },
          ],
        },
      ],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })

  it('validates minimal exercise content (stem only)', () => {
    const validContent = {
      stem: [{ id: 'b1', type: 'rich_text', format: 'md-math-v1', value: 'Question text' }],
    }
    expect(() => ExerciseContentSchema.parse(validContent)).not.toThrow()
  })
})
