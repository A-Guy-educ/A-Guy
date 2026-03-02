import { useTranslations } from '@/ui/web/providers/I18n'
import { Clock } from 'lucide-react'

export function EmptyPlanState() {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-2xl">
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-muted rounded-full">
        <Clock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('empty.title')}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">{t('empty.description')}</p>
    </div>
  )
}
