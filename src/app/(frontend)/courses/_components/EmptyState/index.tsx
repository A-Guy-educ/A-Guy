'use client'

import { useTranslations } from '@/providers/I18n'

type EmptyStateType = 'noCourses' | 'noChapters' | 'noLessons' | 'noPDF'

interface EmptyStateProps {
  type: EmptyStateType
}

export function EmptyState({ type }: EmptyStateProps) {
  const t = useTranslations('courses')
  const message = t(type)
  const className =
    type === 'noPDF'
      ? 'bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center'
      : 'text-gray-500'

  return (
    <div className={className}>
      <p className={type === 'noPDF' ? 'text-gray-700' : ''}>{message}</p>
    </div>
  )
}
