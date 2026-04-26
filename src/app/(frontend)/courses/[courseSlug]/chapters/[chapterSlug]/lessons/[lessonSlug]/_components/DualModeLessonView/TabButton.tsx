'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'

interface TabButtonProps {
  label: string
  active: boolean
  onClick: () => void
  /** DOM id for this tab — referenced by the matching panel's aria-labelledby. */
  id: string
  /** DOM id of the panel this tab controls — wired via aria-controls. */
  controlsId: string
}

export function TabButton({ label, active, onClick, id, controlsId }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controlsId}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        'rounded-md px-4 py-1.5 text-body-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
