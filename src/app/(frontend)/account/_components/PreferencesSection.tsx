'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import Link from 'next/link'

export function PreferencesSection() {
  const t = useTranslations('auth.account')

  return (
    <div className={cn('py-card-padding-sm')}>
      <p className={cn('text-body-md text-muted-foreground')}>
        {t('preferencesPlaceholder')}
      </p>
      <div className={cn('mt-content-gap-sm')}>
        <Button
          asChild
          variant="secondary"
          className={cn('transition-all duration-normal')}
        >
          <Link href="/study-plan">{t('buildExamStudyPlan')}</Link>
        </Button>
      </div>
    </div>
  )
}
