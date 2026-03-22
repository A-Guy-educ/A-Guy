/**
 * @fileType test
 * @domain cody | ui
 * @pattern dashboard-status-labels
 * @ai-summary Tests for label consistency — ensures confusing labels are eliminated
 */

import { describe, it, expect } from 'vitest'
import { stageLabels } from '../../../../src/ui/cody/pipeline-utils'
import { COLUMN_DEFS } from '../../../../src/ui/cody/constants'

describe('Stage Labels', () => {
  it('taskify label is not "Analyzing"', () => {
    expect(stageLabels.taskify).not.toBe('Analyzing')
    expect(stageLabels.taskify).toBe('Classifying')
  })

  it('architect label is not "Architecting"', () => {
    expect(stageLabels.architect).not.toBe('Architecting')
    expect(stageLabels.architect).toBe('Planning')
  })

  it('all stage labels are non-empty strings', () => {
    for (const [key, label] of Object.entries(stageLabels)) {
      expect(label, `stageLabels.${key}`).toBeTruthy()
      expect(typeof label).toBe('string')
    }
  })
})

describe('Column Definitions', () => {
  it('gate-waiting label is "Needs Approval" (not "Gate Waiting")', () => {
    expect(COLUMN_DEFS['gate-waiting'].label).toBe('Needs Approval')
    expect(COLUMN_DEFS['gate-waiting'].label).not.toBe('Gate Waiting')
  })
})
