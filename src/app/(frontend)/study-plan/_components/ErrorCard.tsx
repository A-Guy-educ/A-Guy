'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { AlertCircle } from 'lucide-react'

interface ErrorCardProps {
  message: string
}

export function ErrorCard({ message }: ErrorCardProps) {
  const t = useTranslations('studyPlan')

  return (
    <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            {t('error.pastExamDate')}
          </h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}
