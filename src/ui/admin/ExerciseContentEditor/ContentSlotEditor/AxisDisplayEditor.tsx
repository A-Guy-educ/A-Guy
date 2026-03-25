'use client'

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import React from 'react'
import { AxisCanvas } from '../components/axis/AxisCanvas'
import { AxisConfigPanel } from '../components/axis/AxisConfigPanel'
import { GraphsPanel } from '../components/axis/GraphsPanel'

interface AxisDisplayEditorProps {
  axis: AxisSpecV1
  displaySize?: 'small' | 'medium' | 'large' | 'full'
  onChange: (updates: {
    axis: AxisSpecV1
    displaySize?: 'small' | 'medium' | 'large' | 'full'
  }) => void
}

/**
 * AxisDisplayEditor - Display-only axis graph editor for ContentSlot
 *
 * Stripped down from AxisEditor - only shows config, graphs, and preview.
 * No prompt, answer, hint, or solution fields.
 */
export const AxisDisplayEditor: React.FC<AxisDisplayEditorProps> = ({
  axis,
  displaySize = 'medium',
  onChange,
}) => {
  const updateAxis = React.useCallback(
    (updates: Partial<AxisSpecV1>) => {
      onChange({ axis: { ...axis, ...updates }, displaySize })
    },
    [axis, displaySize, onChange],
  )

  const updateElements = React.useCallback(
    (updates: Partial<AxisSpecV1['elements']>) => {
      updateAxis({ elements: { ...axis.elements, ...updates } })
    },
    [axis.elements, updateAxis],
  )

  return (
    <div className="axis-display-editor">
      <div className="axis-display-editor-config">
        <div className="axis-display-size-select">
          <label>Display Size:</label>
          <select
            value={displaySize}
            onChange={(e) =>
              onChange({
                axis,
                displaySize: e.target.value as 'small' | 'medium' | 'large' | 'full',
              })
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="full">Full</option>
          </select>
        </div>
      </div>

      <div className="axis-display-editor-panels">
        <div className="axis-display-editor-form">
          <div className="axis-display-editor-panel">
            <div className="axis-display-editor-panel-header">Configuration</div>
            <AxisConfigPanel spec={axis} onChange={updateAxis} />
          </div>

          <div className="axis-display-editor-panel">
            <div className="axis-display-editor-panel-header">
              Graphs ({axis.elements.graphs.length})
            </div>
            <GraphsPanel
              graphs={axis.elements.graphs}
              onChange={(graphs) => updateElements({ graphs })}
            />
          </div>
        </div>

        <div className="axis-display-editor-preview">
          <AxisCanvas id={`axis-display-${Math.random().toString(36).substring(7)}}`} axis={axis} />
        </div>
      </div>
    </div>
  )
}
