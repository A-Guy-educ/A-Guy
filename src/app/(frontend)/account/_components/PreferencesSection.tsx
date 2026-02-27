'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import Link from 'next/link'

export function PreferencesSection() {
  const t = useTranslations('auth.account')

  return (
    <div className="py-4">
      <p className="text-muted-foreground">{t('preferencesPlaceholder')}</p>
      <div className="mt-4">
        <Button asChild variant="secondary">
          <Link href="/study-plan">{t('buildExamStudyPlan')}</Link>
        </Button>
      </div>
    </div>
  )
}
