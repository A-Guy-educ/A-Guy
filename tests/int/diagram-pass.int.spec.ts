import {
  buildDiagramPrompt,
  createDiagramMetrics,
  detectDiagramBlocks,
  insertTikzBlock,
  parseDiagramResponse,
} from '@/server/services/exercise-conversion/diagram-pass'
import type { EnrichedExercise } from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, it } from 'vitest'

describe('Diagram Pass', () => {
  describe('detectDiagramBlocks', () => {
    it('should detect blocks starting with "Diagram:"', () => {
      const exercises: EnrichedExercise[] = [
        {
          title: 'Test Exercise',
          orderInSegment: 1,
          blocks: [
            { id: 'b1', type: 'rich_text', value: 'Some intro text' },
            { id: 'b2', type: 'rich_text', value: 'Diagram: A triangle with vertices A, B, C' },
            { id: 'b3', type: 'latex', latex: '\\frac{1}{2}' },
          ],
        },
      ]

      const diagrams = detectDiagramBlocks(exercises)

      expect(diagrams).toHaveLength(1)
      expect(diagrams[0]).toEqual({
        exerciseIndex: 0,
        blockIndex: 1,
        blockId: 'b2',
        description: 'A triangle with vertices A, B, C',
      })
    })

    it('should return empty array when no diagrams', () => {
      const exercises: EnrichedExercise[] = [
        {
          title: 'No Diagram',
          orderInSegment: 1,
          blocks: [{ id: 'b1', type: 'rich_text', value: 'Just text' }],
        },
      ]

      expect(detectDiagramBlocks(exercises)).toHaveLength(0)
    })

    it('should detect multiple diagrams across exercises', () => {
      const exercises: EnrichedExercise[] = [
        {
          title: 'Ex1',
          orderInSegment: 1,
          blocks: [{ id: 'b1', type: 'rich_text', value: 'Diagram: Circle' }],
        },
        {
          title: 'Ex2',
          orderInSegment: 2,
          blocks: [
            { id: 'b2', type: 'rich_text', value: 'Diagram: Square' },
            { id: 'b3', type: 'rich_text', value: 'Diagram: Triangle' },
          ],
        },
      ]

      const diagrams = detectDiagramBlocks(exercises)

      expect(diagrams).toHaveLength(3)
    })

    it('should ignore blocks that do not start with "Diagram:" prefix', () => {
      const exercises: EnrichedExercise[] = [
        {
          title: 'Test',
          orderInSegment: 1,
          blocks: [
            { id: 'b1', type: 'rich_text', value: 'See diagram: below' },
            { id: 'b2', type: 'rich_text', value: 'Diagram: Actual diagram' },
          ],
        },
      ]

      const diagrams = detectDiagramBlocks(exercises)

      expect(diagrams).toHaveLength(1)
      expect(diagrams[0].description).toBe('Actual diagram')
    })
  })

  describe('parseDiagramResponse', () => {
    it('should parse valid JSON response', () => {
      const response = '{"tikz":"\\\\begin{tikzpicture}\\\\end{tikzpicture}","confidence":"high"}'
      const result = parseDiagramResponse(response)

      expect(result).toEqual({
        tikz: '\\begin{tikzpicture}\\end{tikzpicture}',
        confidence: 'high',
        notes: undefined,
      })
    })

    it('should parse JSON wrapped in markdown code blocks', () => {
      const response = '```json\n{"tikz":"code","confidence":"medium"}\n```'
      const result = parseDiagramResponse(response)

      expect(result).toEqual({
        tikz: 'code',
        confidence: 'medium',
        notes: undefined,
      })
    })

    it('should return null for invalid JSON', () => {
      expect(parseDiagramResponse('not json')).toBeNull()
    })

    it('should return null when tikz field missing', () => {
      expect(parseDiagramResponse('{"confidence":"high"}')).toBeNull()
    })

    it('should return null when tikz field is not a string', () => {
      expect(parseDiagramResponse('{"tikz":123,"confidence":"high"}')).toBeNull()
    })

    it('should default confidence to low when invalid', () => {
      const response = '{"tikz":"code","confidence":"invalid"}'
      const result = parseDiagramResponse(response)

      expect(result?.confidence).toBe('low')
    })

    it('should parse notes field when present', () => {
      const response = '{"tikz":"code","confidence":"high","notes":"Test note"}'
      const result = parseDiagramResponse(response)

      expect(result?.notes).toBe('Test note')
    })
  })

  describe('insertTikzBlock', () => {
    it('should insert latex block after specified index', () => {
      const exercise: EnrichedExercise = {
        title: 'Test',
        orderInSegment: 1,
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'Diagram: Circle' },
          { id: 'b2', type: 'rich_text', value: 'Question text' },
        ],
      }

      insertTikzBlock(exercise, 0, '\\begin{tikzpicture}\\end{tikzpicture}')

      expect(exercise.blocks).toHaveLength(3)
      expect(exercise.blocks[1].type).toBe('latex')
      expect((exercise.blocks[1] as { latex: string }).latex).toBe(
        '\\begin{tikzpicture}\\end{tikzpicture}',
      )
      expect(exercise.blocks[2].id).toBe('b2') // Original block shifted
    })

    it('should generate unique ID for latex block', () => {
      const exercise: EnrichedExercise = {
        title: 'Test',
        orderInSegment: 1,
        blocks: [{ id: 'b1', type: 'rich_text', value: 'Diagram: Circle' }],
      }

      insertTikzBlock(exercise, 0, 'tikz1')
      insertTikzBlock(exercise, 0, 'tikz2')

      const latexBlocks = exercise.blocks.filter((b) => b.type === 'latex')
      expect(latexBlocks).toHaveLength(2)
      expect((latexBlocks[0] as { id: string }).id).not.toBe((latexBlocks[1] as { id: string }).id)
    })
  })

  describe('buildDiagramPrompt', () => {
    it('should include all required sections', () => {
      const basePrompt = 'You are an expert.'
      const description = 'A triangle with vertices A, B, C'
      const title = 'Geometry Problem'
      const segment = { pageStart: 1, pageEnd: 2 }

      const result = buildDiagramPrompt(basePrompt, description, title, segment)

      expect(result).toContain('You are an expert.')
      expect(result).toContain('A triangle with vertices A, B, C')
      expect(result).toContain('Geometry Problem')
      expect(result).toContain('1-2')
      expect(result).toContain('"tikz":')
      expect(result).toContain('"confidence":')
      expect(result).toContain('Output Format')
    })
  })

  describe('createDiagramMetrics', () => {
    it('should return zeroed metrics', () => {
      const metrics = createDiagramMetrics()

      expect(metrics.detected).toBe(0)
      expect(metrics.attempted).toBe(0)
      expect(metrics.succeeded).toBe(0)
      expect(metrics.failed).toBe(0)
      expect(metrics.skipped).toBe(0)
      expect(metrics.latencyMs).toBe(0)
    })
  })
})
