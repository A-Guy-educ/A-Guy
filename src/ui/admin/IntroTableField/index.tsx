'use client'

import React, { useCallback } from 'react'
import { useField } from '@payloadcms/ui'
import { Plus, Trash2 } from 'lucide-react'

/**
 * Custom Payload admin field component for editing table headers.
 * Stores data as a JSON string (array of strings).
 */
export const IntroTableHeadersField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })

  const headers: string[] = React.useMemo(() => {
    if (!value) return ['Column 1', 'Column 2']
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : ['Column 1', 'Column 2']
    } catch {
      return ['Column 1', 'Column 2']
    }
  }, [value])

  const update = useCallback(
    (newHeaders: string[]) => {
      setValue(JSON.stringify(newHeaders))
    },
    [setValue],
  )

  const handleChange = (index: number, val: string) => {
    const next = [...headers]
    next[index] = val
    update(next)
  }

  const handleAdd = () => {
    update([...headers, `Column ${headers.length + 1}`])
  }

  const handleRemove = (index: number) => {
    if (headers.length <= 1) return
    update(headers.filter((_, i) => i !== index))
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
        Headers
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {headers.map((header, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={header}
              onChange={(e) => handleChange(i, e.target.value)}
              placeholder={`Column ${i + 1}`}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 4,
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text)',
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              disabled={headers.length <= 1}
              style={{
                padding: 6,
                border: 'none',
                background: 'transparent',
                cursor: headers.length <= 1 ? 'not-allowed' : 'pointer',
                opacity: headers.length <= 1 ? 0.3 : 0.7,
                color: 'var(--theme-text)',
              }}
              title="Remove column"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px dashed var(--theme-elevation-150)',
            borderRadius: 4,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            fontSize: 13,
          }}
        >
          <Plus size={14} />
          Add Column
        </button>
      </div>
    </div>
  )
}

/**
 * Custom Payload admin field component for editing table rows.
 * Stores data as a JSON string (array of string arrays).
 * Reads the headers field from the sibling path to know column count.
 */
export const IntroTableRowsField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })

  // Read sibling headers field to know column count
  const headersPath = path.replace(/\.rows$/, '.headers')
  const { value: headersValue } = useField<string>({ path: headersPath })

  const headers: string[] = React.useMemo(() => {
    if (!headersValue) return ['Column 1', 'Column 2']
    try {
      const parsed = JSON.parse(headersValue)
      return Array.isArray(parsed) ? parsed : ['Column 1', 'Column 2']
    } catch {
      return ['Column 1', 'Column 2']
    }
  }, [headersValue])

  const rows: string[][] = React.useMemo(() => {
    if (!value) return [Array(headers.length).fill('')]
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [Array(headers.length).fill('')]
    } catch {
      return [Array(headers.length).fill('')]
    }
  }, [value, headers.length])

  const update = useCallback(
    (newRows: string[][]) => {
      setValue(JSON.stringify(newRows))
    },
    [setValue],
  )

  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const next = rows.map((row) => [...row])
    next[rowIndex][colIndex] = val
    update(next)
  }

  const handleAddRow = () => {
    update([...rows, Array(headers.length).fill('')])
  }

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return
    update(rows.filter((_, i) => i !== index))
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
        Rows
      </label>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '2px solid var(--theme-elevation-150)',
                    textAlign: 'start',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--theme-text)',
                    opacity: 0.7,
                  }}
                >
                  {h}
                </th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {headers.map((_, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: 4,
                      borderBottom: '1px solid var(--theme-elevation-100)',
                    }}
                  >
                    <input
                      type="text"
                      value={row[ci] ?? ''}
                      onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        border: '1px solid var(--theme-elevation-100)',
                        borderRadius: 3,
                        background: 'var(--theme-input-bg)',
                        color: 'var(--theme-text)',
                        fontSize: 14,
                      }}
                    />
                  </td>
                ))}
                <td style={{ padding: 4 }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(ri)}
                    disabled={rows.length <= 1}
                    style={{
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: rows.length <= 1 ? 0.3 : 0.7,
                      color: 'var(--theme-text)',
                    }}
                    title="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={handleAddRow}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          marginTop: 6,
          border: '1px dashed var(--theme-elevation-150)',
          borderRadius: 4,
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--theme-text)',
          fontSize: 13,
        }}
      >
        <Plus size={14} />
        Add Row
      </button>
    </div>
  )
}
