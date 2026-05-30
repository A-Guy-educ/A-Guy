'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Package } from 'lucide-react'

export function EmptyProducts() {
  const t = useTranslations('products')

  return (
    <div className="flex flex-col items-center justify-center py-section-md text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-content-gap">
        <Package className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-body-lg text-muted-foreground">{t('noProducts')}</p>
    </div>
  )
}
