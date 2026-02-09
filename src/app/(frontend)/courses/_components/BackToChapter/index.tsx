'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'

interface BackToChapterProps {
  href: string
}

export function BackToChapter({ href }: BackToChapterProps) {
  const t = useTranslations('courses')
  return (
    <Button asChild variant="outline" size="lg">
      <SystemLink href={href}>{t('backToChapter')}</SystemLink>
    </Button>
  )
}
