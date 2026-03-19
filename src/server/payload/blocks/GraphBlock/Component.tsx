'use client'

import React, { useMemo } from 'react'
import { AxisRenderer } from '@/ui/web/exerciserenderer/blocks/AxisRenderer'
import type { DisplaySize } from '@/ui/web/exerciserenderer/blocks/AxisRenderer'

import type { GraphBlock as GraphBlockType } from '@/payload-types'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

type Props = GraphBlockType & {
  className?: string
  disableInnerContainer?: boolean
}

export const GraphBlock: React.FC<Props> = ({ id, spec, displaySize }) => {
  const parsed = useMemo<AxisSpecV1 | null>(() => {
    if (!spec) return null
    try {
      return (typeof spec === 'string' ? JSON.parse(spec) : spec) as AxisSpecV1
    } catch {
      return null
    }
  }, [spec])

  if (!parsed) return null

  return (
    <div className="flex justify-center">
      <AxisRenderer
        blockId={id ?? 'graph'}
        spec={parsed}
        displaySize={(displaySize as DisplaySize) ?? 'full'}
      />
    </div>
  )
}
