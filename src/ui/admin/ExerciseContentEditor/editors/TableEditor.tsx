'use client'

import React from 'react'
import type { QuestionTableBlock } from '@/server/payload/collections/Exercises/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'
import { Plus, Trash2 } from 'lucide-react'

interface TableEditorProps {
  block: QuestionTableBlock
  onChange: (block: QuestionTableBlock) => void
}

export const TableEditor: React.FC<TableEditorProps> = ({ block, onChange }) => {
  const { table } = block

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...table.headers]
    newHeaders[index] = value
    onChange({
      ...block,
      table: { ...table, headers: newHeaders },
    })
  }

  const handleAddHeader = () => {
    onChange({
      ...block,
      table: {
        ...table,
        headers: [...table.headers, `Column ${table.headers.length + 1}`],
        columnAlignment: [...(table.columnAlignment || []), 'left'],
      },
    })
  }

  const handleRemoveHeader = (index: number) => {
    if (table.headers.length <= 1) return
    const newHeaders = table.headers.filter((_, i) => i !== index)
    const newAlignment = table.columnAlignment?.filter((_, i) => i !== index)
    const newRowsData = table.rowsData.map((row) => row.filter((_, i) => i !== index))
    const newAnswers: Record<string, string> = {}
    Object.entries(table.answers || {}).forEach(([key, value]) => {
      const [rowIdx, colIdx] = key.split('-').map(Number)
      if (colIdx !== index) {
        const newColIdx = colIdx > index ? colIdx - 1 : colIdx
        newAnswers[`${rowIdx}-${newColIdx}`] = value
      }
    })
    onChange({
      ...block,
      table: {
        ...table,
        headers: newHeaders,
        columnAlignment: newAlignment,
        rowsData: newRowsData,
        answers: newAnswers,
      },
    })
  }

  const handleColumnAlignmentChange = (index: number, alignment: 'left' | 'center' | 'right') => {
    const newAlignment = [...(table.columnAlignment || [])]
    newAlignment[index] = alignment
    onChange({
      ...block,
      table: { ...table, columnAlignment: newAlignment },
    })
  }

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRowsData = [...table.rowsData]
    newRowsData[rowIndex] = [...newRowsData[rowIndex]]
    newRowsData[rowIndex][colIndex] = value
    // Clean up answer key when cell gets content (no longer fillable)
    const key = `${rowIndex}-${colIndex}`
    const newAnswers = { ...(table.answers || {}) }
    if (value !== '' && key in newAnswers) {
      delete newAnswers[key]
    }
    onChange({
      ...block,
      table: { ...table, rowsData: newRowsData, answers: newAnswers },
    })
  }

  const handleAddRow = () => {
    const newRow = Array(table.headers.length).fill('')
    onChange({
      ...block,
      table: {
        ...table,
        rowsData: [...table.rowsData, newRow],
      },
    })
  }

  const handleRemoveRow = (rowIndex: number) => {
    if (table.rowsData.length <= 1) return
    const newRowsData = table.rowsData.filter((_, i) => i !== rowIndex)
    const newAnswers: Record<string, string> = {}
    Object.entries(table.answers || {}).forEach(([key, value]) => {
      const [rowIdx, colIdx] = key.split('-').map(Number)
      if (rowIdx !== rowIndex) {
        const newRowIdx = rowIdx > rowIndex ? rowIdx - 1 : rowIdx
        newAnswers[`${newRowIdx}-${colIdx}`] = value
      }
    })
    onChange({
      ...block,
      table: {
        ...table,
        rowsData: newRowsData,
        answers: newAnswers,
      },
    })
  }

  const handleToggleSolutionFill = () => {
    if (table.solutionFill) {
      onChange({
        ...block,
        table: { ...table, solutionFill: false },
      })
    } else {
      onChange({
        ...block,
        table: { ...table, solutionFill: true, answers: table.answers || {} },
      })
    }
  }

  const handleAnswerChange = (rowIndex: number, colIndex: number, value: string) => {
    const newAnswers = { ...(table.answers || {}) }
    newAnswers[`${rowIndex}-${colIndex}`] = value
    onChange({
      ...block,
      table: { ...table, answers: newAnswers },
    })
  }

  const handleToggleBorders = () => {
    onChange({
      ...block,
      table: { ...table, showBorders: !table.showBorders },
    })
  }

  const handleToggleHeader = () => {
    onChange({
      ...block,
      table: { ...table, showHeader: !table.showHeader },
    })
  }

  return (
    <div className="table-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(newPrompt) => onChange({ ...block, prompt: newPrompt })}
          placeholder="Enter your table question..."
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Table Configuration</label>
        <div className="table-config-options">
          <label className="table-config-option">
            <input type="checkbox" checked={table.showBorders} onChange={handleToggleBorders} />
            <span>Show Borders</span>
          </label>
          <label className="table-config-option">
            <input type="checkbox" checked={table.showHeader} onChange={handleToggleHeader} />
            <span>Show Header</span>
          </label>
          <label className="table-config-option table-config-option--highlight">
            <input
              type="checkbox"
              checked={table.solutionFill}
              onChange={handleToggleSolutionFill}
            />
            <span>Solution Fill Mode</span>
          </label>
        </div>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Headers</label>
        <div className="table-headers-editor">
          {table.headers.map((header, index) => (
            <div key={index} className="table-header-row">
              <input
                type="text"
                className="table-header-input"
                value={header}
                onChange={(e) => handleHeaderChange(index, e.target.value)}
                placeholder={`Column ${index + 1}`}
              />
              <select
                className="table-align-select"
                value={table.columnAlignment?.[index] || 'left'}
                onChange={(e) =>
                  handleColumnAlignmentChange(index, e.target.value as 'left' | 'center' | 'right')
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <button
                type="button"
                className="table-header-remove-btn"
                onClick={() => handleRemoveHeader(index)}
                disabled={table.headers.length <= 1}
                title="Remove column"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="table-add-header-btn" onClick={handleAddHeader}>
            <Plus size={14} />
            <span>Add Column</span>
          </button>
        </div>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Data Rows</label>
        <div className="table-rows-container">
          {table.rowsData.map((row, rowIndex) => (
            <div key={rowIndex} className="table-row">
              <div className="table-row-label">Row {rowIndex + 1}</div>
              <div className="table-row-cells">
                {row.map((cell, colIndex) => {
                  const isFillable = table.solutionFill && cell === ''
                  return (
                    <div
                      key={colIndex}
                      className={`table-cell-wrapper${isFillable ? ' table-cell-wrapper--fillable' : ''}`}
                    >
                      {table.solutionFill && (
                        <span className="table-cell-label">
                          {cell === '' ? 'Student fills in' : 'Display'}
                        </span>
                      )}
                      <input
                        type="text"
                        className="table-cell-input"
                        style={{ textAlign: table.columnAlignment?.[colIndex] || 'left' }}
                        value={cell}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        placeholder={
                          table.solutionFill ? 'Type text or leave empty for fill-in' : ''
                        }
                      />
                      {isFillable && (
                        <div className="table-solution-input-wrapper">
                          <label className="table-solution-label">Answer:</label>
                          <input
                            type="text"
                            className="table-solution-input"
                            placeholder="Type the correct answer"
                            value={table.answers?.[`${rowIndex}-${colIndex}`] || ''}
                            onChange={(e) => handleAnswerChange(rowIndex, colIndex, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                className="table-row-remove-btn"
                onClick={() => handleRemoveRow(rowIndex)}
                disabled={table.rowsData.length <= 1}
                title="Remove row"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="table-add-row-btn" onClick={handleAddRow}>
          <Plus size={14} />
          <span>Add Row</span>
        </button>
      </div>

      <div className="question-editor-section">
        <HintSolutionPanel
          hint={block.hint}
          solution={block.solution}
          fullSolution={block.fullSolution}
          blockId={block.id}
          onChange={(field, value) => onChange({ ...block, [field]: value })}
          onBatchChange={(fields) => onChange({ ...block, ...fields })}
        />
      </div>
    </div>
  )
}
