import {
  extractMediaIds,
  extractAllMediaIds,
} from '@/ui/web/exerciserenderer/utils/extractMediaIds'
import { describe, expect, it } from 'vitest'

describe('extractMediaIds', () => {
  it('returns empty array when blocks have no mediaIds', () => {
    const result = extractMediaIds({
      blocks: [{ type: 'rich_text' }, { type: 'question_select' }],
    })
    expect(result).toEqual([])
  })

  it('extracts mediaIds from block-level mediaIds', () => {
    const result = extractMediaIds({
      blocks: [{ type: 'rich_text', mediaIds: ['m1', 'm2'] }],
    })
    expect(result).toEqual(['m1', 'm2'])
  })

  it('extracts mediaIds from prompt field', () => {
    const result = extractMediaIds({
      blocks: [{ type: 'question_select', prompt: { mediaIds: ['m3'] } }],
    })
    expect(result).toEqual(['m3'])
  })

  it('extracts mediaIds from hint and solution fields', () => {
    const result = extractMediaIds({
      blocks: [
        {
          type: 'question_free_response',
          hint: { mediaIds: ['h1'] },
          solution: { mediaIds: ['s1'] },
          fullSolution: { mediaIds: ['fs1'] },
        },
      ],
    })
    expect(result).toEqual(['h1', 's1', 'fs1'])
  })

  it('extracts mediaIds from options labels', () => {
    const result = extractMediaIds({
      blocks: [
        {
          type: 'question_select',
          options: [{ label: { mediaIds: ['ol1'] } }, { label: { mediaIds: ['ol2'] } }],
        },
      ],
    })
    expect(result).toEqual(['ol1', 'ol2'])
  })

  it('extracts mediaIds from answer options content', () => {
    const result = extractMediaIds({
      blocks: [
        {
          type: 'question_select',
          answer: {
            options: [{ content: { mediaIds: ['ac1'] } }, { content: { mediaIds: ['ac2'] } }],
          },
        },
      ],
    })
    expect(result).toEqual(['ac1', 'ac2'])
  })

  it('deduplicates mediaIds across all fields', () => {
    const result = extractMediaIds({
      blocks: [
        {
          type: 'rich_text',
          mediaIds: ['shared'],
          prompt: { mediaIds: ['shared'] },
          hint: { mediaIds: ['shared', 'unique'] },
        },
      ],
    })
    expect(result).toEqual(['shared', 'unique'])
  })

  it('skips falsy ids', () => {
    const result = extractMediaIds({
      blocks: [{ type: 'rich_text', mediaIds: ['m1', '', 'm2'] }],
    })
    expect(result).toEqual(['m1', 'm2'])
  })

  it('handles multiple blocks', () => {
    const result = extractMediaIds({
      blocks: [
        { type: 'rich_text', mediaIds: ['a'] },
        { type: 'question_select', prompt: { mediaIds: ['b'] } },
        { type: 'latex', mediaIds: ['c'] },
      ],
    })
    expect(result).toEqual(['a', 'b', 'c'])
  })
})

describe('extractAllMediaIds', () => {
  it('returns empty array for empty exercises list', () => {
    expect(extractAllMediaIds([])).toEqual([])
  })

  it('extracts mediaIds across multiple exercises', () => {
    const exercises = [
      { content: { blocks: [{ type: 'rich_text', mediaIds: ['e1m1'] }] } },
      { content: { blocks: [{ type: 'rich_text', mediaIds: ['e2m1', 'e2m2'] }] } },
    ]
    const result = extractAllMediaIds(exercises)
    expect(result).toEqual(['e1m1', 'e2m1', 'e2m2'])
  })

  it('deduplicates across exercises', () => {
    const exercises = [
      { content: { blocks: [{ type: 'rich_text', mediaIds: ['shared'] }] } },
      { content: { blocks: [{ type: 'rich_text', mediaIds: ['shared', 'unique'] }] } },
    ]
    const result = extractAllMediaIds(exercises)
    expect(result).toEqual(['shared', 'unique'])
  })

  it('handles exercises with no blocks', () => {
    const exercises = [{ content: {} }, { content: null }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = extractAllMediaIds(exercises as any)
    expect(result).toEqual([])
  })
})
