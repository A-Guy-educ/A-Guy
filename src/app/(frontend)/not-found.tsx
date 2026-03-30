'use client'

import Link from 'next/link'
import React from 'react'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function NotFound() {
  const t = useTranslations('common.notFound')

  return (
    <div className="container py-section-lg flex flex-col items-center justify-center text-center animate-in fade-in">
      <h1 className="text-display-md font-bold mb-2">{t('title')}</h1>
      <p className="text-body-lg text-muted-foreground mb-8">{t('message')}</p>
      <Button asChild variant="default">
        <Link href="/">{t('goHome')}</Link>
      </Button>
    </div>
  )
}
