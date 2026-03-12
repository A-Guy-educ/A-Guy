'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { FileText, Pencil } from 'lucide-react'

export function DocumentModeToggle() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('exercises')
  const isDocMode = searchParams.get('mode') === 'document'

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    if (isDocMode) {
      params.delete('mode')
    } else {
      params.set('mode', 'document')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
        'border border-border hover:bg-muted transition-colors',
      )}
      title={isDocMode ? t('interactiveMode') : t('documentMode')}
    >
      {isDocMode ? <Pencil className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      <span>{isDocMode ? t('interactiveMode') : t('documentMode')}</span>
    </button>
  )
}
