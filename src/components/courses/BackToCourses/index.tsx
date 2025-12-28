'use client'

import Link from 'next/link'
import { useTranslations } from '@/providers/I18n'

export function BackToCourses() {
  const t = useTranslations('courses')
  return (
    <nav className="mb-6">
      <Link href="/courses" className="text-blue-600 hover:underline">
        ← {t('backToCourses')}
      </Link>
    </nav>
  )
}
