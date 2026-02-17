'use client'

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { AlertCircle } from 'lucide-react'

interface RemediationBubbleProps {
  remediation: string
}

export function RemediationBubble({ remediation }: RemediationBubbleProps) {
  return (
    <div className="interactive-demo-remediation bg-muted/50 border border-border rounded-lg p-4 mt-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <MathMarkdown content={remediation} className="text-sm text-foreground leading-relaxed" />
        </div>
      </div>
    </div>
  )
}
