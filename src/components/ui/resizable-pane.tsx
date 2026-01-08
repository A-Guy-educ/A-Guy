'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/utilities/ui'

interface ResizablePaneProps {
  orientation: 'horizontal' | 'vertical'
  defaultSize?: number
  minSize?: number
  maxSize?: number
  children: [React.ReactNode, React.ReactNode]
  className?: string
  storageKey?: string // Optional key to persist size in localStorage
}

export function ResizablePane({
  orientation,
  defaultSize = 50,
  minSize = 15,
  maxSize = 80,
  children,
  className,
  storageKey,
}: ResizablePaneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize size from localStorage if available, otherwise use defaultSize
  const [firstPaneSize, setFirstPaneSize] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          return parsed
        }
      }
    }
    return defaultSize
  })

  const handleMouseDown = () => {
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.userSelect = 'auto'
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    let percentage: number

    if (orientation === 'horizontal') {
      // Vertical resizer (left/right split)
      percentage = ((clientX - rect.left) / rect.width) * 100
    } else {
      // Horizontal resizer (top/bottom split)
      percentage = ((clientY - rect.top) / rect.height) * 100
    }

    // Constrain within bounds
    if (percentage >= minSize && percentage <= maxSize) {
      setFirstPaneSize(percentage)
    }
  }

  // Save to localStorage when size changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, firstPaneSize.toString())
    }
  }, [firstPaneSize, storageKey])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('touchmove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchend', handleMouseUp)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging])

  const isVertical = orientation === 'horizontal' // vertical resizer for horizontal split
  const resizerClasses = cn(
    'bg-[#eef2f6] flex items-center justify-center shrink-0 z-20 transition-colors',
    isVertical
      ? 'w-3 cursor-col-resize border-x border-[#dee2e6]'
      : 'h-3 cursor-ns-resize border-y border-[#dee2e6]',
    isDragging && 'bg-primary/10',
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex overflow-hidden',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {/* First Pane */}
      <div
        style={{
          flex: `0 0 ${firstPaneSize}%`,
        }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Resizer Handle */}
      <div
        className={resizerClasses}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        role="separator"
        aria-valuenow={firstPaneSize}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        aria-label="Resize panels"
        tabIndex={0}
        onKeyDown={(e) => {
          if (orientation === 'horizontal') {
            if (e.key === 'ArrowLeft') {
              setFirstPaneSize(Math.max(minSize, firstPaneSize - 5))
            } else if (e.key === 'ArrowRight') {
              setFirstPaneSize(Math.min(maxSize, firstPaneSize + 5))
            }
          } else {
            if (e.key === 'ArrowUp') {
              setFirstPaneSize(Math.max(minSize, firstPaneSize - 5))
            } else if (e.key === 'ArrowDown') {
              setFirstPaneSize(Math.min(maxSize, firstPaneSize + 5))
            }
          }
        }}
      >
        <div
          className={cn(
            'bg-[#cbd5e0] rounded-full transition-all',
            isVertical ? 'w-1 h-10' : 'w-10 h-1',
            isDragging && 'bg-primary',
            !isDragging && 'hover:bg-primary hover:scale-110',
          )}
        />
      </div>

      {/* Second Pane */}
      <div className="flex-1 overflow-hidden">{children[1]}</div>
    </div>
  )
}
