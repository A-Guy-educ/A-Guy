'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/infra/utils/ui'
import { Check } from 'lucide-react'

const ACCENT_PRESETS = [
  { name: 'Burgundy', hue: '353 73%', light: '29%', dark: '56%' }, // default
  { name: 'Ocean', hue: '217 91%', light: '40%', dark: '60%' },
  { name: 'Forest', hue: '142 71%', light: '35%', dark: '45%' },
  { name: 'Sunset', hue: '25 95%', light: '43%', dark: '53%' },
  { name: 'Violet', hue: '271 91%', light: '45%', dark: '65%' },
  { name: 'Rose', hue: '330 81%', light: '40%', dark: '60%' },
] as const

const STORAGE_KEY = 'aguy-accent-color'

function getStoredAccent(): number {
  if (typeof window === 'undefined') return 0
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? parseInt(stored, 10) : 0
}

function applyAccent(index: number) {
  const preset = ACCENT_PRESETS[index]
  if (!preset) return

  const root = document.documentElement
  // Apply to both themes by setting the CSS variable directly
  root.style.setProperty('--primary', `${preset.hue} ${preset.light}`)
  // Also set ring to match
  root.style.setProperty('--ring', `${preset.hue} ${preset.light}`)

  localStorage.setItem(STORAGE_KEY, String(index))
}

export function AccentPicker({ className }: { className?: string }) {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const stored = getStoredAccent()
    setSelected(stored)
    if (stored !== 0) {
      applyAccent(stored)
    }
  }, [])

  const handleSelect = (index: number) => {
    setSelected(index)
    applyAccent(index)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {ACCENT_PRESETS.map((preset, i) => (
        <button
          key={preset.name}
          onClick={() => handleSelect(i)}
          className={cn(
            'w-8 h-8 rounded-full border-2 transition-all duration-normal',
            'hover:scale-110 active:scale-95',
            selected === i ? 'border-foreground scale-110' : 'border-transparent',
          )}
          style={{ backgroundColor: `hsl(${preset.hue} ${preset.light})` }}
          title={preset.name}
          aria-label={`${preset.name} accent color`}
        >
          {selected === i && <Check className="w-4 h-4 text-white mx-auto" />}
        </button>
      ))}
    </div>
  )
}

// Call this on app init to restore saved accent
export function restoreAccent() {
  if (typeof window === 'undefined') return
  const stored = getStoredAccent()
  if (stored !== 0) {
    applyAccent(stored)
  }
}
