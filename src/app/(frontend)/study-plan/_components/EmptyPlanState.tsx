import { useTranslations } from '@/ui/web/providers/I18n'
import { Clock } from 'lucide-react'

export function EmptyPlanState() {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex flex-col items-center justify-center py-section-md px-4 border-2 border-dashed border-border rounded-2xl animate-in fade-in">
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-primary/5 rounded-full">
        <Clock className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-heading-lg font-semibold text-foreground mb-2">{t('empty.title')}</h3>
      <p className="text-body-sm text-muted-foreground text-center max-w-md">
        {t('empty.description')}
      </p>
    </div>
  )
}
