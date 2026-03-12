'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface DocumentModeWrapperProps {
  children: React.ReactNode
  title?: string
  showPrintButton?: boolean
}

export function DocumentModeWrapper({
  children,
  title,
  showPrintButton = true,
}: DocumentModeWrapperProps) {
  const t = useTranslations('exercises')

  return (
    <div className="document-mode bg-background mx-auto max-w-3xl font-serif">
      <div className="px-16 py-12">
        {title && <h1 className="mb-8 text-center text-2xl font-bold">{title}</h1>}
        <div className="text-base leading-relaxed">{children}</div>
      </div>
      {showPrintButton && (
        <div className="print:hidden fixed bottom-4 right-4">
          <button
            onClick={() => window.print()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
          >
            {t('printDocument')}
          </button>
        </div>
      )}
    </div>
  )
}
