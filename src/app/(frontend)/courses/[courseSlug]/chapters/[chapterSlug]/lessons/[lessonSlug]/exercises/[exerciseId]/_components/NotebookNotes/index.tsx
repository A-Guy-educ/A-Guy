'use client'

import React, { useState } from 'react'
import { useTranslations } from '@/providers/I18n'
import './index.scss'

export function NotebookNotes() {
  const t = useTranslations('courses')
  const [value, setValue] = useState('')

  return (
    <div className="notebook-notes">
      <h3 className="notebook-notes__title">{t('notesSubtitle')}</h3>
      <textarea
        className="notebook-notes__textarea"
        placeholder={t('notesPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
}
