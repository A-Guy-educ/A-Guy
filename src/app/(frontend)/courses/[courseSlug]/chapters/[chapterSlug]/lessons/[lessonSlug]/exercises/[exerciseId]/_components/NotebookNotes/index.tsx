'use client'

import React, { useState } from 'react'
import { useTranslations } from '@/ui/providers/I18n'

export function NotebookNotes() {
  const t = useTranslations('courses')
  const [value, setValue] = useState('')

  return (
    <div className="p-7 bg-card text-foreground h-full flex flex-col min-h-0 overflow-y-auto justify-start">
      <h3 className="text-base font-extrabold mb-5 pb-2.5 border-b-2 border-border">
        {t('notesSubtitle')}
      </h3>
      <textarea
        className="flex-1 border-none bg-muted text-foreground rounded-lg p-4 text-base leading-relaxed resize-none focus:outline-none focus:border focus:border-primary"
        placeholder={t('notesPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
}
