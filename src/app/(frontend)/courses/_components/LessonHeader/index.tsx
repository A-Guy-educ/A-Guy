'use client'

import { isRTL } from '@/i18n/config'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * Normalizes text for comparison by trimming whitespace,
 * collapsing multiple spaces, and converting to lowercase.
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

interface LessonHeaderProps {
  order: number
  title: string
  description?: string | null
}

export function LessonHeader({ order, title, description }: LessonHeaderProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const router = useRouter()

  const shouldShowDescription = description && normalizeText(description) !== normalizeText(title)

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/courses')
    }
  }

  return (
    <header className="mb-8 relative">
      <button
        onClick={handleBack}
        className={cn(
          'absolute -top-2 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
          rtl ? 'right-0' : 'left-0',
        )}
        aria-label={t('back')}
      >
        {rtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        <span className="text-sm">{t('back')}</span>
      </button>
      <div className="mb-2 mt-8">
        <span className="text-sm font-semibold text-muted-foreground">
          {t('lesson')} {order}
        </span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-xl text-muted-foreground">{description}</p>}
    </header>
  )
}
