'use client'

import { Button } from '@/ui/web/components/button'

interface ContinueButtonProps {
  onClick: () => void
  disabled?: boolean
  t: {
    continue: string
  }
}

export function ContinueButton({ onClick, disabled, t }: ContinueButtonProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg z-50">
      <div className="container max-w-4xl mx-auto flex justify-end">
        <Button onClick={onClick} disabled={disabled} size="lg">
          {t.continue}
        </Button>
      </div>
    </div>
  )
}
