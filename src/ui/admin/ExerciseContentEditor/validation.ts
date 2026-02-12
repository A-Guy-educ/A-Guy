/**
 * Validation helpers for Exercise Content Editor
 */

import type { ContentBlock, QuestionTableBlock } from '@/shared/exercise-content/types'

/**
 * Validates Solution Fill Mode tables.
 * Returns an error message if validation fails, null if valid.
 *
 * When solutionFill is true, all empty cells must have corresponding answers.
 * This performs client-side validation before save to provide immediate feedback.
 */
export function validateSolutionFillTables(value: { blocks: ContentBlock[] }): string | null {
  for (const block of value.blocks) {
    if (block.type === 'question_table') {
      const tableBlock = block as QuestionTableBlock
      if (tableBlock.table.solutionFill) {
        let missingCount = 0
        const missingPreview: string[] = []

        // Count all missing cells, collect only first 10 for preview
        for (let rowIdx = 0; rowIdx < tableBlock.table.rowsData.length; rowIdx++) {
          for (let colIdx = 0; colIdx < tableBlock.table.rowsData[rowIdx].length; colIdx++) {
            if (tableBlock.table.rowsData[rowIdx][colIdx] === '') {
              const key = `${rowIdx}-${colIdx}`
              if (!tableBlock.table.answers || !(key in tableBlock.table.answers)) {
                missingCount++
                // Only collect first 10 positions for preview
                if (missingPreview.length < 10) {
                  missingPreview.push(`Row ${rowIdx + 1}, Col ${colIdx + 1}`)
                }
              }
            }
          }
        }

        if (missingCount > 0) {
          const preview = missingPreview.join(', ')
          const more = missingCount > 10 ? ` and ${missingCount - 10} more` : ''
          return `Solution Fill Mode requires all empty cells to have answers. ${missingCount} empty cell${missingCount > 1 ? 's' : ''} missing answers: ${preview}${more}. Please complete all answers or disable Solution Fill Mode.`
        }
      }
    }
  }
  return null
}
