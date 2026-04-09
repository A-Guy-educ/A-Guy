/**
 * Free Response Question Component
 * Auto-toggling write/view mode: focused = textarea, blurred = rendered math.
 * Textarea stays mounted (no remount hitch). View overlay hides/shows on top.
 * FormulaComposer opens as a popup. Formula button sits above the textbox edge.
 */

'use client'

import React, { useRef, useCallback, useLayoutEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Textarea } from '@/ui/web/components/textarea'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { FormulaComposer } from '@/ui/web/shared/MathInput/FormulaComposer'
import { FunctionSquare, Pencil } from 'lucide-react'
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

  const MAX_HEIGHT = 200

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
      {/* Question container */}
      <div className="rounded-2xl border border-border/40 bg-background/60 dark:bg-card dark:border-border/60 dark:shadow-card p-content-gap">
        <div
          className="w-8 h-1 rounded-full mb-3"
          style={{ backgroundColor: 'hsl(var(--tab-ask))' }}
        />
        <div className="text-body-md font-medium text-foreground leading-relaxed">
          <RichTextRenderer block={promptBlock} />
        </div>
      </div>

      {/* Answer box with formula button */}
      <div
        className="relative rounded-xl border-2 border-[hsl(var(--tab-ask)/0.3)] bg-[hsl(var(--tab-ask)/0.04)] dark:border-[hsl(var(--tab-ask)/0.4)] dark:shadow-card overflow-hidden"
        data-math-controls
      >
        {/* Textarea — always mounted, hidden behind overlay when in view mode */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={t('enterAnswer')}
          className="text-body-md min-h-0 resize-none overflow-hidden pe-10 bg-transparent border-none shadow-none focus:outline-none focus:ring-0 focus:shadow-none placeholder:text-muted-foreground/50 placeholder:italic"
          rows={3}
        />

        {/* View overlay: rendered content on top of textarea */}
        <AnimatePresence>
          {showViewOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={switchToEditMode}
              className="absolute inset-0 px-3 py-2 pe-10 bg-transparent text-body-md leading-relaxed cursor-text overflow-hidden"
            >
              <MathMarkdown content={value} />
              {/* Edit indicator */}
              {!disabled && (
                <span className="absolute top-2 end-2 text-muted-foreground/40">
                  <Pencil className="w-3.5 h-3.5" />
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formula button — pill style */}
        {showMathTools && !disabled && (
          <button
            type="button"
            onClick={() => setComposerOpen(!composerOpen)}
            className="absolute end-1.5 top-2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[hsl(var(--tab-ask))] text-white shadow-card hover:shadow-card-hover transition-all duration-normal z-10 text-body-xs font-semibold"
            title={t('insertFormula')}
          >
            <FunctionSquare className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Popup formula composer */}
        <AnimatePresence>
          {composerOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 start-0 end-0 z-10"
            >
              <FormulaComposer
                onInsert={handleFormulaInsert}
                onClose={() => setComposerOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
