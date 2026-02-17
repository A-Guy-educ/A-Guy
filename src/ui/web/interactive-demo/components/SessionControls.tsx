'use client'

import { Button } from '@/ui/web/components/button'

interface SessionControlsProps {
  onReset: () => void
  t: {
    reset: string
    resetConfirm: string
  }
}

export function SessionControls({ onReset, t }: SessionControlsProps) {
  const handleReset = () => {
    if (window.confirm(t.resetConfirm)) {
      onReset()
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReset}>
      {t.reset}
    </Button>
  )
}
