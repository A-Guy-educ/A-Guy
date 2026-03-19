'use client'

import React, { useMemo } from 'react'
import { GeometryRenderer } from '@/ui/web/exerciserenderer/blocks/GeometryRenderer'

import type { GeometryBlock as GeometryBlockType } from '@/payload-types'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'

type Props = GeometryBlockType & {
  className?: string
  disableInnerContainer?: boolean
}

export const GeometryBlock: React.FC<Props> = ({ id, spec }) => {
  const parsed = useMemo<GeometrySpecV1 | null>(() => {
    if (!spec) return null
    try {
      return (typeof spec === 'string' ? JSON.parse(spec) : spec) as GeometrySpecV1
    } catch {
      return null
    }
  }, [spec])

  if (!parsed) return null

  return (
    <div className="flex justify-center">
      <GeometryRenderer blockId={id ?? 'geometry'} spec={parsed} />
    </div>
  )
}
