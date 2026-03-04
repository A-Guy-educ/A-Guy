/**
 * MathField — React wrapper for MathLive's <math-field> web component.
 * Dynamically imports mathlive to avoid SSR issues (same pattern as JSXGraphBoard).
 * Provides a WYSIWYG math editing experience with LaTeX output.
 */

'use client'

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { cn } from '@/infra/utils/ui'
import type { MathfieldElement } from 'mathlive'

export interface MathFieldProps {
  value: string
  onChange: (latex: string) => void
  onReady?: (element: MathfieldElement) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export interface MathFieldRef {
  element: MathfieldElement | null
}

export const MathField = forwardRef<MathFieldRef, MathFieldProps>(
  ({ value, onChange, onReady, disabled = false, placeholder, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mfeRef = useRef<MathfieldElement | null>(null)
    const currentValue = useRef(value)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady

    useImperativeHandle(ref, () => ({ element: mfeRef.current }), [])

    useEffect(() => {
      let destroyed = false
      const container = containerRef.current

      async function init() {
        const { MathfieldElement } = await import('mathlive')
        if (destroyed || !container) return

        const mfe = new MathfieldElement()
        mfe.mathVirtualKeyboardPolicy = 'manual'
        if (placeholder) mfe.placeholder = placeholder
        mfe.readOnly = disabled
        mfe.setValue(value, { silenceNotifications: true })

        mfe.addEventListener('input', () => {
          const newVal = mfe.value
          if (currentValue.current !== newVal) {
            currentValue.current = newVal
            onChangeRef.current(newVal)
          }
        })

        container.appendChild(mfe)
        mfeRef.current = mfe
        onReadyRef.current?.(mfe)
      }

      init()

      return () => {
        destroyed = true
        const mfe = mfeRef.current
        if (mfe && container) {
          try {
            // Release MathLive's global keystroke capture before removal
            mfe.blur()
            if (document.activeElement === mfe) {
              ;(document.activeElement as HTMLElement).blur()
            }
            container.removeChild(mfe)
          } catch {
            /* element already removed */
          }
          mfeRef.current = null
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync external value changes
    useEffect(() => {
      if (mfeRef.current && currentValue.current !== value) {
        const pos = mfeRef.current.position
        mfeRef.current.setValue(value, { silenceNotifications: true })
        mfeRef.current.position = pos
        currentValue.current = value
      }
    }, [value])

    // Sync disabled state
    useEffect(() => {
      if (mfeRef.current) mfeRef.current.readOnly = disabled
    }, [disabled])

    return (
      <div
        ref={containerRef}
        className={cn(
          'math-field-wrapper',
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
      />
    )
  },
)

MathField.displayName = 'MathField'
