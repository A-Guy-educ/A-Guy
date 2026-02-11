/**
 * Normalization functions for question block editors.
 * These functions enforce invariants to prevent invalid states.
 */

import type { QuestionSelectMcqBlock } from '@/shared/exercise-content/types'

/**
 * Normalize MCQ block: sync multiSelect with selectionMode.
 * If selectionMode is 'single', ensure multiSelect is false and correctOptionIds has exactly 1.
 * If selectionMode is 'multiple', ensure multiSelect is true.
 */
export function normalizeMcq(block: QuestionSelectMcqBlock): QuestionSelectMcqBlock {
  const newBlock = { ...block }

  if (newBlock.selectionMode === 'single') {
    newBlock.answer.multiSelect = false
    // Ensure exactly one correct option
    if (newBlock.answer.correctOptionIds.length !== 1 && newBlock.answer.options.length > 0) {
      newBlock.answer.correctOptionIds = [newBlock.answer.options[0].id]
    }
    // Trim to first if multiple
    if (newBlock.answer.correctOptionIds.length > 1) {
      newBlock.answer.correctOptionIds = [newBlock.answer.correctOptionIds[0]]
    }
  } else {
    newBlock.answer.multiSelect = true
  }

  return newBlock
}

/**
 * When an option is removed, clean up correctOptionIds.
 * If the removed option was correct, auto-select the first remaining option if any.
 */
export function removeOptionAndNormalize(
  block: QuestionSelectMcqBlock,
  optionId: string,
): QuestionSelectMcqBlock {
  const newBlock = { ...block }

  // Actually remove the option from the options array
  newBlock.answer = {
    ...newBlock.answer,
    options: newBlock.answer.options.filter((o) => o.id !== optionId),
  }

  // Get remaining option IDs from the filtered options
  const optionIds = new Set(newBlock.answer.options.map((o) => o.id))

  // Remove deleted option from correctOptionIds
  newBlock.answer.correctOptionIds = newBlock.answer.correctOptionIds.filter((id) =>
    optionIds.has(id),
  )

  // If no correct options remain but options still exist, auto-select first
  if (newBlock.answer.correctOptionIds.length === 0 && optionIds.size > 0) {
    newBlock.answer.correctOptionIds = [optionIds.values().next().value as string]
  }

  return normalizeMcq(newBlock)
}

/**
 * When selectionMode changes, reset correctOptionIds if needed.
 */
export function changeSelectionMode(
  block: QuestionSelectMcqBlock,
  mode: 'single' | 'multiple',
): QuestionSelectMcqBlock {
  const newBlock = { ...block, selectionMode: mode }

  if (mode === 'single' && newBlock.answer.correctOptionIds.length > 0) {
    // Keep only first correct option
    newBlock.answer.correctOptionIds = [newBlock.answer.correctOptionIds[0]]
  }

  return normalizeMcq(newBlock)
}

/**
 * Add a new option and normalize.
 */
export function addOptionAndNormalize(
  block: QuestionSelectMcqBlock,
  newOption: {
    id: string
    content: { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds: string[] }
  },
): QuestionSelectMcqBlock {
  const newBlock: QuestionSelectMcqBlock = {
    ...block,
    answer: {
      ...block.answer,
      options: [...block.answer.options, { id: newOption.id, content: newOption.content }],
    },
  }

  // If no correct option selected, select the new one
  if (newBlock.answer.correctOptionIds.length === 0) {
    newBlock.answer.correctOptionIds = [newOption.id]
  }

  return normalizeMcq(newBlock)
}

/**
 * Update an option and normalize.
 */
export function updateOptionAndNormalize(
  block: QuestionSelectMcqBlock,
  optionId: string,
  updates: Partial<{
    content: { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds: string[] }
  }>,
): QuestionSelectMcqBlock {
  const newBlock: QuestionSelectMcqBlock = {
    ...block,
    answer: {
      ...block.answer,
      options: block.answer.options.map((opt) =>
        opt.id === optionId ? { ...opt, ...updates } : opt,
      ),
    },
  }

  return newBlock
}

/**
 * Toggle correct option and normalize.
 */
export function toggleCorrectOption(
  block: QuestionSelectMcqBlock,
  optionId: string,
): QuestionSelectMcqBlock {
  const newBlock: QuestionSelectMcqBlock = { ...block }

  if (block.selectionMode === 'single') {
    // Single mode: only this option can be correct
    newBlock.answer.correctOptionIds = [optionId]
  } else {
    // Multiple mode: toggle
    const isCorrect = newBlock.answer.correctOptionIds.includes(optionId)
    if (isCorrect) {
      newBlock.answer.correctOptionIds = newBlock.answer.correctOptionIds.filter(
        (id) => id !== optionId,
      )
    } else {
      newBlock.answer.correctOptionIds = [...newBlock.answer.correctOptionIds, optionId]
    }
  }

  return normalizeMcq(newBlock)
}

/**
 * Table normalizers - Stage 2
 */

import type { QuestionTableBlock } from '@/shared/exercise-content/types'

/**
 * When header count changes, resize each row and update columnAlignment.
 */
export function normalizeTableOnHeaderChange(
  block: QuestionTableBlock,
  newHeaders: string[],
): QuestionTableBlock {
  const oldHeaderCount = block.table.headers.length
  const newHeaderCount = newHeaders.length
  const newAlignment = [...(block.table.columnAlignment || [])]

  // Adjust column alignment
  if (newHeaderCount > oldHeaderCount) {
    // Add left alignment for new columns
    for (let i = oldHeaderCount; i < newHeaderCount; i++) {
      newAlignment.push('left')
    }
  } else {
    // Trim alignment array
    newAlignment.length = newHeaderCount
  }

  // Resize each row to match new header count
  const newRowsData = block.table.rowsData.map((row) => {
    if (newHeaderCount > row.length) {
      // Pad with empty strings
      return [...row, ...Array(newHeaderCount - row.length).fill('')]
    } else {
      // Trim
      return row.slice(0, newHeaderCount)
    }
  })

  // Adjust answers keys for removed columns
  const newAnswers: Record<string, string> = {}
  if (block.table.answers) {
    Object.entries(block.table.answers).forEach(([key, value]) => {
      const [, colIdxStr] = key.split('-')
      const colIdx = Number(colIdxStr)
      if (colIdx < newHeaderCount) {
        if (colIdx < oldHeaderCount) {
          newAnswers[key] = value
        }
      }
    })
  }

  return {
    ...block,
    table: {
      ...block.table,
      headers: newHeaders,
      columnAlignment: newAlignment,
      rowsData: newRowsData,
      answers: newAnswers,
    },
  }
}

/**
 * When rows are added/removed, drop out-of-bounds answer keys.
 */
export function normalizeTableAnswers(
  block: QuestionTableBlock,
  newRowsData: string[][],
): QuestionTableBlock {
  const newAnswers: Record<string, string> = {}
  const rowCount = newRowsData.length
  const colCount = block.table.headers.length

  if (block.table.answers) {
    Object.entries(block.table.answers).forEach(([key, value]) => {
      const [rowIdx, colIdx] = key.split('-').map(Number)
      if (rowIdx < rowCount && colIdx < colCount) {
        newAnswers[key] = value
      }
    })
  }

  return {
    ...block,
    table: {
      ...block.table,
      rowsData: newRowsData,
      answers: newAnswers,
    },
  }
}

/**
 * When toggling solutionFill on, ensure answers object exists.
 */
export function normalizeTableSolutionFillOn(block: QuestionTableBlock): QuestionTableBlock {
  return {
    ...block,
    table: {
      ...block.table,
      solutionFill: true,
      answers: block.table.answers || {},
    },
  }
}

/**
 * When toggling solutionFill off, keep answers but don't enforce.
 */
export function normalizeTableSolutionFillOff(block: QuestionTableBlock): QuestionTableBlock {
  return {
    ...block,
    table: {
      ...block.table,
      solutionFill: false,
    },
  }
}

/**
 * Add a row to the table.
 */
export function addTableRow(block: QuestionTableBlock): QuestionTableBlock {
  const newRow = Array(block.table.headers.length).fill('')
  return normalizeTableAnswers(block, [...block.table.rowsData, newRow])
}

/**
 * Remove a row from the table.
 */
export function removeTableRow(block: QuestionTableBlock, rowIndex: number): QuestionTableBlock {
  const newRowsData = block.table.rowsData.filter((_, i) => i !== rowIndex)
  return normalizeTableAnswers(block, newRowsData)
}
