'use client'

import Link from 'next/link'
import { useTranslations } from '@/ui/providers/I18n'
import { Button } from '@/ui/components/button'

export function BackToCourses() {
  const t = useTranslations('courses')
  return (
    <nav className="mb-6">
      <Button variant="link" asChild className="pl-0">
        <Link href="/courses">← {t('backToCourses')}</Link>
      </Button>
    </nav>
  )
}
