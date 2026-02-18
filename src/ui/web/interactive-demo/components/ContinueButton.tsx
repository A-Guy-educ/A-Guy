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
    <div className="mt-4 rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4">
      <div className="flex justify-end">
        <Button onClick={onClick} disabled={disabled} size="lg" className="rounded-full min-w-[140px]">
          {t.continue}
        </Button>
      </div>
    </div>
  )
}
