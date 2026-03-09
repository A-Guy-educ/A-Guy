/**
 * Free Response Question Component
 * Auto-toggling write/view mode: focused = textarea, blurred = rendered math.
 * Textarea stays mounted (no remount hitch). View overlay hides/shows on top.
 * FormulaComposer opens as a popup. Formula button sits on the textbox edge.
 */

'use client'

import React, { useRef, useCallback, useLayoutEffect, useState } from 'react'
import { Textarea } from '@/ui/web/components/textarea'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { FormulaComposer } from '@/ui/web/shared/MathInput/FormulaComposer'
import { FunctionSquare } from 'lucide-react'
import type { QuestionFreeResponseBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface FreeResponseQuestionProps {
  question: QuestionFreeResponseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
  showMathTools?: boolean
}

export function FreeResponseQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
  showMathTools = true,
}: FreeResponseQuestionProps) {
  const value = answer?.type === 'free_response' ? answer.value : ''
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  const MAX_HEIGHT = 160

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const clamped = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${clamped}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    autoResize()
  }, [value, autoResize])

  const handleFormulaInsert = useCallback(
    (latex: string) => {
      const el = textareaRef.current
      const start = el?.selectionStart ?? value.length
      const end = el?.selectionEnd ?? value.length
      const before = value.substring(0, start)
      const after = value.substring(end)
      const wrapped = `$${latex}$`
      const newValue = before + wrapped + after
      onChange({ type: 'free_response', value: newValue })
      setIsEditing(false)
      setComposerOpen(false)
    },
    [value, onChange],
  )

  const switchToEditMode = useCallback(() => {
    if (disabled) return
    setIsEditing(true)
    const ta = textareaRef.current
    if (ta) {
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [disabled])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    const related = e.relatedTarget as HTMLElement | null
    if (related?.closest('[data-math-controls]')) return
    setIsEditing(false)
  }, [])

  // Show view overlay when not editing and there's content with formulas
  const showViewOverlay = !isEditing && !!value

  return (
    <div className="flex flex-col gap-3">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>

      {/* Answer box with formula button on edge */}
      <div className="relative" data-math-controls>
        {/* Textarea — always mounted, hidden behind overlay when in view mode */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={t('enterAnswer')}
          className="text-base min-h-0 resize-none overflow-hidden pe-10"
          rows={1}
        />

        {/* View overlay: rendered content on top of textarea */}
        {showViewOverlay && (
          <div
            onClick={switchToEditMode}
            className="absolute inset-0 px-3 py-2 pe-10 rounded-md border border-input bg-background text-base leading-relaxed cursor-text overflow-hidden"
          >
            <MathMarkdown content={value} />
          </div>
        )}

        {/* Formula button on the edge — end = right in LTR, left in RTL */}
        {showMathTools && !disabled && (
          <button
            type="button"
            onClick={() => setComposerOpen(!composerOpen)}
            className="absolute end-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors z-10"
            title={t('insertFormula')}
          >
            <FunctionSquare className="w-4 h-4" />
          </button>
        )}

        {/* Popup formula composer */}
        {composerOpen && (
          <div className="absolute top-full mt-2 start-0 end-0 z-10">
            <FormulaComposer
              onInsert={handleFormulaInsert}
              onClose={() => setComposerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
