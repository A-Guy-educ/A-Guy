'use client'

import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import * as React from 'react'

/**
 * @fileType component
 * @domain study-mode
 * @pattern content-canvas
 * @ai-summary Centered content area with max-width constraints
 */

interface ContentCanvasProps {
  children: React.ReactNode
  className?: string
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export function ContentCanvas({ children, className, scrollRef }: ContentCanvasProps) {
  return (
    <div ref={scrollRef} className={cn('flex-1 overflow-y-auto', 'bg-mode-bg', className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-4xl mx-auto p-6 md:p-8"
      >
        {/* Subtle gradient overlay */}
        <div className="fixed inset-0 bg-gradient-to-br from-mode-surface/30 via-transparent to-transparent pointer-events-none" />

        {/* Content container */}
        <div className="relative">{children}</div>
      </motion.div>
    </div>
  )
}
