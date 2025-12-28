'use client'

import { useTranslations } from '@/providers/I18n'

export function CoursesPageTitle() {
  const t = useTranslations('courses')
  return <h1 className="text-4xl font-bold mb-8">{t('title')}</h1>
}
