'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Sheet, SheetContent, SheetTrigger } from '@/ui/web/components/sheet'
import { cn } from '@/infra/utils/ui'
import { MessageSquare, Image as ImageIcon, Send, X } from 'lucide-react'
import React, { useState, useRef, useCallback } from 'react'

interface FloatingAskButtonProps {
  /** Callback when the ask button is clicked and sheet should open */
  onAskClick?: () => void
  /** When true, the button is centered (e.g., when Prev/Next navigation is visible) */
  isCentered?: boolean
  /** Course ID for the chat context */
  courseId?: string
  /** Lesson ID for the chat context */
  lessonId?: string
  /** Exercise ID for the chat context */
  exerciseId?: string
}

/**
 * Floating Ask Button component
 *
 * A floating action button that opens a bottom sheet for submitting a question
 * or photo. Fixed to bottom-left corner (above safe-area on iOS).
 *
 * Issue #1741: [Mobile] Floating "שאל שאלה" button in bottom-left corner
 */
export function FloatingAskButton({
  onAskClick,
  isCentered = false,
  courseId,
  lessonId,
  exerciseId,
}: FloatingAskButtonProps) {
  const t = useTranslations('courses')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      // Reset form when sheet closes
      setQuestionText('')
      setSelectedImage(null)
    }
  }, [])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
    }
  }, [])

  const handleSubmit = useCallback(() => {
    // Dispatch event to open chat with the question
    // The ChatInterface will listen for this event and process the question
    const event = new CustomEvent('ask-from-floating-button', {
      detail: {
        question: questionText,
        image: selectedImage,
        courseId,
        lessonId,
        exerciseId,
      },
    })
    window.dispatchEvent(event)

    // Close the sheet
    setSheetOpen(false)
    setQuestionText('')
    setSelectedImage(null)

    // Also trigger the onAskClick callback if provided
    onAskClick?.()
  }, [questionText, selectedImage, courseId, lessonId, exerciseId, onAskClick])

  const buttonPosition = isCentered ? 'left-1/2 -translate-x-1/2' : 'left-0'

  return (
    <Sheet open={sheetOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'fixed bottom-0 z-[70] p-4',
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
            buttonPosition,
            'text-primary-foreground bg-primary rounded-full',
            'shadow-elevation-3 hover:scale-110 hover:bg-primary/90',
            'transition-all duration-normal flex items-center justify-center',
            'w-14 h-14 md:hidden',
          )}
          aria-label={t('askTip') || 'Ask a question'}
          onClick={() => setSheetOpen(true)}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className={cn('pb-[max(1rem,env(safe-area-inset-bottom))]', 'rounded-t-2xl')}
        hideClose
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-body-lg font-semibold text-foreground">{t('ask') || 'Ask'}</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Question Input */}
          <div className="relative">
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t('chatInputPlaceholder') || 'Ask a question...'}
              className={cn(
                'w-full px-4 py-3 pr-12',
                'bg-muted rounded-xl',
                'border border-input',
                'text-body-md text-foreground',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                'transition-all duration-fast',
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && questionText.trim()) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'p-1.5 rounded-lg',
                'text-muted-foreground hover:text-primary',
                'hover:bg-primary/10',
                'transition-colors',
              )}
              aria-label="Add image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {/* Selected Image Preview */}
          {selectedImage && (
            <div className="relative inline-block">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Selected"
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className={cn(
                  'absolute -top-2 -right-2',
                  'w-5 h-5 rounded-full',
                  'bg-destructive text-destructive-foreground',
                  'flex items-center justify-center',
                  'text-xs font-bold',
                )}
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!questionText.trim() && !selectedImage}
            className={cn(
              'w-full py-3 px-4',
              'bg-primary text-primary-foreground',
              'rounded-xl font-medium text-body-md',
              'flex items-center justify-center gap-2',
              'hover:bg-primary/90 disabled:opacity-disabled',
              'transition-all duration-normal',
            )}
          >
            <Send className="w-4 h-4" />
            <span>{t('ask') || 'Ask'}</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * AskSheet component - the bottom sheet content for asking questions
 * This is exported for use in other contexts if needed
 */
export interface AskSheetProps {
  onSubmit: (question: string, image?: File) => void
  onClose: () => void
  courseId?: string
  lessonId?: string
  exerciseId?: string
}

export function AskSheet({
  onSubmit,
  onClose,
  courseId: _courseId,
  lessonId: _lessonId,
  exerciseId: _exerciseId,
}: AskSheetProps) {
  const t = useTranslations('courses')
  const [questionText, setQuestionText] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
    }
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit(questionText, selectedImage || undefined)
    setQuestionText('')
    setSelectedImage(null)
  }, [questionText, selectedImage, onSubmit])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-body-lg font-semibold text-foreground">{t('ask') || 'Ask'}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Question Input */}
      <div className="relative">
        <input
          type="text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder={t('chatInputPlaceholder') || 'Ask a question...'}
          className={cn(
            'w-full px-4 py-3 pr-12',
            'bg-muted rounded-xl',
            'border border-input',
            'text-body-md text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'transition-all duration-fast',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && questionText.trim()) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'p-1.5 rounded-lg',
            'text-muted-foreground hover:text-primary',
            'hover:bg-primary/10',
            'transition-colors',
          )}
          aria-label="Add image"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className="relative inline-block">
          <img
            src={URL.createObjectURL(selectedImage)}
            alt="Selected"
            className="w-20 h-20 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className={cn(
              'absolute -top-2 -right-2',
              'w-5 h-5 rounded-full',
              'bg-destructive text-destructive-foreground',
              'flex items-center justify-center',
              'text-xs font-bold',
            )}
            aria-label="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!questionText.trim() && !selectedImage}
        className={cn(
          'w-full py-3 px-4',
          'bg-primary text-primary-foreground',
          'rounded-xl font-medium text-body-md',
          'flex items-center justify-center gap-2',
          'hover:bg-primary/90 disabled:opacity-disabled',
          'transition-all duration-normal',
        )}
      >
        <Send className="w-4 h-4" />
        <span>{t('ask') || 'Ask'}</span>
      </button>
    </div>
  )
}
