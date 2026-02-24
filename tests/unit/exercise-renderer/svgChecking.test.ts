import { describe, it, expect } from 'vitest'
import {
  checkSvgAnswer,
  type AnswerErrorMessages,
} from '@/ui/web/exerciserenderer/utils/answerChecking'
import type { SvgBlock } from '@/ui/web/exerciserenderer/types'

const messages: AnswerErrorMessages = {
  invalidAnswerType: 'Invalid answer type',
  selectTrueFalse: 'Select true or false',
  noCorrectAnswer: 'No correct answer defined',
  selectAnAnswer: 'Please select an answer',
  enterAnAnswer: 'Please enter an answer',
  unknownVariant: 'Unknown variant',
  validationFailed: 'Validation failed',
  validationError: 'Validation error',
  connectionError: 'Connection error',
}

function makeSvgBlock(correctIds: string[]): SvgBlock {
  return {
    id: 'svg-1',
    type: 'svg',
    value: '<svg></svg>',
    interactive: true,
    hotspots: correctIds.map((id) => ({ id, selector: `#${id}` })),
    correctHotspotIds: correctIds,
  }
}

describe('checkSvgAnswer', () => {
  it('returns correct for exact single hotspot match', () => {
    const block = makeSvgBlock(['h1'])
    const result = checkSvgAnswer(block, ['h1'], messages)
    expect(result.isCorrect).toBe(true)
  })

  it('returns correct for exact multi-hotspot match', () => {
    const block = makeSvgBlock(['h1', 'h2', 'h3'])
    const result = checkSvgAnswer(block, ['h2', 'h1', 'h3'], messages)
    expect(result.isCorrect).toBe(true)
  })

  it('returns incorrect for wrong hotspot', () => {
    const block = makeSvgBlock(['h1'])
    const result = checkSvgAnswer(block, ['h2'], messages)
    expect(result.isCorrect).toBe(false)
  })

  it('returns incorrect for subset of correct hotspots', () => {
    const block = makeSvgBlock(['h1', 'h2'])
    const result = checkSvgAnswer(block, ['h1'], messages)
    expect(result.isCorrect).toBe(false)
  })

  it('returns incorrect for superset of correct hotspots', () => {
    const block = makeSvgBlock(['h1'])
    const result = checkSvgAnswer(block, ['h1', 'h2'], messages)
    expect(result.isCorrect).toBe(false)
  })

  it('returns error for no selection', () => {
    const block = makeSvgBlock(['h1'])
    const result = checkSvgAnswer(block, [], messages)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('Please select an answer')
  })

  it('returns error when no correct answer defined', () => {
    const block: SvgBlock = {
      id: 'svg-1',
      type: 'svg',
      value: '<svg></svg>',
      interactive: true,
      hotspots: [{ id: 'h1', selector: '#h1' }],
      correctHotspotIds: [],
    }
    const result = checkSvgAnswer(block, ['h1'], messages)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('No correct answer defined')
  })
})
