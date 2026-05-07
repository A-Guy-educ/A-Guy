'use client'

import type { User } from '@/payload-types'
import { PageTransition } from '@/ui/web/components/page-transition'
import { useTranslations } from '@/ui/web/providers/I18n'
import { EmptyState } from '@/ui/web/shared/EmptyState/EmptyState'
import { Brain } from 'lucide-react'
import Link from 'next/link'

interface MemoryPageContentProps {
  user: User
}

export function MemoryPageContent({ user: _user }: MemoryPageContentProps) {
  const t = useTranslations('auth.account')

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl space-y-content-gap">
          <h1 className="text-display-sm font-bold">{t('memoryPage.title')}</h1>
          <EmptyState
            icon={Brain}
            title={t('memoryPage.title')}
            description={t('memoryPage.description')}
            action={
              <Link
                href="https://a-guy.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t('memoryPage.privacyLink')}
              </Link>
            }
          />
        </div>
      </div>
    </PageTransition>
  )
}
