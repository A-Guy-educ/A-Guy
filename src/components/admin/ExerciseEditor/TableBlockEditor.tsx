'use client'

/**
 * Table Block Editor
 */

import React from 'react'
import type { TableBlock } from '@/contracts'
import type { BlockEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { TablePreview } from './previews/TablePreview'

export function TableBlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  errors,
}: BlockEditorProps<TableBlock>) {
  const addColumn = () => {
    onChange({
      ...block,
      headers: [...block.headers, `Column ${block.headers.length + 1}`],
      rows: block.rows.map((row) => [...row, '']),
      columnAlignment: [...block.columnAlignment, 'left'],
    })
  }

  const removeColumn = (index: number) => {
    onChange({
      ...block,
      headers: block.headers.filter((_, i) => i !== index),
      rows: block.rows.map((row) => row.filter((_, i) => i !== index)),
      columnAlignment: block.columnAlignment.filter((_, i) => i !== index),
    })
  }

  const addRow = () => {
    onChange({
      ...block,
      rows: [...block.rows, Array(block.headers.length).fill('')],
    })
  }

  const removeRow = (index: number) => {
    onChange({
      ...block,
      rows: block.rows.filter((_, i) => i !== index),
    })
  }

  const updateHeader = (index: number, value: string) => {
    const newHeaders = [...block.headers]
    newHeaders[index] = value
    onChange({ ...block, headers: newHeaders })
  }

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = block.rows.map((row, rIdx) =>
      rIdx === rowIndex ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell)) : row,
    )
    onChange({ ...block, rows: newRows })
  }

  const updateAlignment = (index: number, alignment: 'left' | 'center' | 'right') => {
    const newAlignment = [...block.columnAlignment]
    newAlignment[index] = alignment
    onChange({ ...block, columnAlignment: newAlignment })
  }

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h4>Table</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="btn btn--style-secondary btn--size-small"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="btn btn--style-secondary btn--size-small"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn--style-secondary btn--size-small"
          >
            Delete
          </button>
        </div>
      </div>

      <ErrorDisplay errors={errors} />

      <div>
        {/* Table Options */}
        <div
          style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={block.showHeader}
              onChange={(e) => onChange({ ...block, showHeader: e.target.checked })}
            />
            Show Header
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={block.showBorders}
              onChange={(e) => onChange({ ...block, showBorders: e.target.checked })}
            />
            Show Borders
          </label>
        </div>

        {/* Table Editor */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', border: '1px solid var(--theme-elevation-150)' }}>
            <thead style={{ background: 'var(--theme-elevation-50)' }}>
              <tr>
                <th
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    border: '1px solid var(--theme-elevation-150)',
                  }}
                >
                  #
                </th>
                {block.headers.map((header, idx) => (
                  <th
                    key={idx}
                    style={{ padding: '0.5rem', border: '1px solid var(--theme-elevation-150)' }}
                  >
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(idx, e.target.value)}
                      style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      placeholder={`Header ${idx + 1}`}
                    />
                    <select
                      value={block.columnAlignment[idx]}
                      onChange={(e) =>
                        updateAlignment(idx, e.target.value as 'left' | 'center' | 'right')
                      }
                      style={{
                        width: '100%',
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeColumn(idx)}
                      className="btn btn--style-secondary btn--size-small"
                      style={{ marginTop: '0.25rem', width: '100%' }}
                    >
                      Remove
                    </button>
                  </th>
                ))}
                <th style={{ padding: '0.5rem', border: '1px solid var(--theme-elevation-150)' }}>
                  <button
                    type="button"
                    onClick={addColumn}
                    className="btn btn--style-secondary btn--size-small"
                  >
                    + Column
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      border: '1px solid var(--theme-elevation-150)',
                    }}
                  >
                    {rowIdx + 1}
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      style={{ padding: '0.5rem', border: '1px solid var(--theme-elevation-150)' }}
                    >
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        placeholder={`R${rowIdx + 1}C${colIdx + 1}`}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid var(--theme-elevation-150)' }}>
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      className="btn btn--style-secondary btn--size-small"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addRow}
          className="btn btn--style-secondary btn--size-small"
          style={{ marginTop: '0.75rem' }}
        >
          + Add Row
        </button>

        {/* Preview */}
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Rendered Preview</h4>
          <TablePreview block={block} />
        </div>
      </div>
    </div>
  )
}
