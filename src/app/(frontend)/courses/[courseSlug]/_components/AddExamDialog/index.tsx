'use client'

import { useState } from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/web/components/dialog'
import type { ExamDate } from '@/client/state/localStorage/examDates'

interface AddExamDialogProps {
  onAdd: (exam: ExamDate) => void
  trigger: React.ReactNode
}

export function AddExamDialog({ onAdd, trigger }: AddExamDialogProps) {
  const t = useTranslations('coursePage')
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')

  const handleSubmit = () => {
    if (!date) return
    onAdd({
      id: crypto.randomUUID(),
      date,
      label: label.trim() || undefined,
    })
    setDate('')
    setLabel('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addExam')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('examDate')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('examLabel')}</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('examLabelPlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              maxLength={50}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!date}>
            {t('addExam')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
