'use client'

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import React from 'react'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'
import { AxisCanvas } from '../components/axis/AxisCanvas'
import { AxisConfigPanel } from '../components/axis/AxisConfigPanel'
import { AxisPointsPanel } from '../components/axis/AxisPointsPanel'
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
 * Uses the same layout (graph-editor-layout) and CollapsibleSection panels
 * as the full AxisEditor, without prompt/answer/hint fields.
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

  const canvasId = React.useMemo(
    () => `axis-display-${Math.random().toString(36).substring(7)}`,
    [],
  )

  return (
    <div>
      <div className="flex items-center gap-content-gap mb-3">
        <label className="text-body-xs font-medium text-muted-foreground">Display Size:</label>
        <select
          className="px-2 py-1 border border-input rounded-md text-body-xs bg-background text-foreground"
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

      <div className="graph-editor-layout">
        <div className="graph-editor-form">
          <CollapsibleSection title="Configuration" defaultExpanded={false}>
            <AxisConfigPanel spec={axis} onChange={(s) => onChange({ axis: s, displaySize })} />
          </CollapsibleSection>

          <CollapsibleSection title={`Graphs (${axis.elements.graphs.length})`} defaultExpanded>
            <GraphsPanel
              graphs={axis.elements.graphs}
              onChange={(graphs) => updateElements({ graphs })}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={`Points (${axis.elements.points.length})`}
            defaultExpanded={false}
          >
            <AxisPointsPanel
              points={axis.elements.points}
              onChange={(points) => updateElements({ points })}
            />
          </CollapsibleSection>
        </div>

        <div className="graph-editor-canvas">
          <AxisCanvas id={canvasId} axis={axis} />
        </div>
      </div>
    </div>
  )
}
