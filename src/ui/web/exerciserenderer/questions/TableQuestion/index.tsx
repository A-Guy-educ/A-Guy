/**
 * Table Question Component
 * Renders a table-based question with optional fillable cells and answer checking.
 * Per-cell feedback is managed internally; overall result flows to parent via callback.
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import type { QuestionTableBlock, UserAnswer, RichTextBlock, TableCellResult } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import { ExerciseTable } from './ExerciseTable'
import { validateTableAnswers } from '../../utils/tableValidation'
import { Button } from '@/ui/web/components/button'
import { cn } from '@/infra/utils/ui'
import { CheckCircle2 } from 'lucide-react'

interface TableQuestionProps {
  question: QuestionTableBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checked: boolean
  allCorrect: boolean
  onCheckResult: (isCorrect: boolean) => void
  t: (key: string) => string
}

export function TableQuestion({
  question,
  answer,
  onChange,
  disabled: _disabled,
  checked,
  allCorrect,
  onCheckResult,
  t,
}: TableQuestionProps) {
  const [cellResults, setCellResults] = useState<TableCellResult[]>([])
  const EMPTY_CELLS: Record<string, string> = useMemo(() => ({}), [])
  const cellValues = answer.type === 'table' ? answer.cellValues : EMPTY_CELLS
  const hasFillableCells = question.table.solutionFill && !!question.table.answers

  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  const handleCellChange = useCallback(
    (key: string, value: string) => {
      const updated = { ...cellValues, [key]: value }
      onChange({ type: 'table', cellValues: updated })
    },
    [cellValues, onChange],
  )

  const handleCheck = useCallback(() => {
    if (!question.table.answers) return
    const { cellResults: results, allCorrect: correct } = validateTableAnswers(
      cellValues,
      question.table.answers,
    )
    setCellResults(results)
    onCheckResult(correct)
  }, [cellValues, question.table.answers, onCheckResult])

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>

      <ExerciseTable
        table={question.table}
        cellValues={cellValues}
        onCellChange={handleCellChange}
        cellResults={cellResults}
        disabled={allCorrect}
      />

      {hasFillableCells && (
        <div className="flex justify-end">
          <Button
            onClick={handleCheck}
            disabled={allCorrect}
            size="lg"
            className={cn(
              'font-semibold',
              allCorrect && 'bg-success hover:bg-success/90 text-white',
            )}
          >
            {allCorrect ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {t('correct')}
              </>
            ) : checked ? (
              t('tryAgain')
            ) : (
              t('checkTable')
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
