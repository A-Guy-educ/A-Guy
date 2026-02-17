'use client'

import { cn } from '@/infra/utils/ui'

interface BlockCardProps {
  children: React.ReactNode
  label?: string
  role?: 'assistant' | 'user'
  className?: string
}

export function BlockCard({
  children,
  label = 'A-Guy',
  role = 'assistant',
  className,
}: BlockCardProps) {
  const borderColor = role === 'assistant' ? 'border-l-blue-500' : 'border-l-green-500'

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 border-l-4',
        borderColor,
        className,
      )}
    >
      {/* Header with label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>

      {/* Content */}
      <div className="space-y-2">{children}</div>
    </div>
  )
}
