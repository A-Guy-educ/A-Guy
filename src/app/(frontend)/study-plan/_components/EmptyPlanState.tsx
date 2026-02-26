import { useTranslations } from '@/ui/web/providers/I18n'
import { Clock } from 'lucide-react'

export function EmptyPlanState() {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-slate-300 rounded-2xl">
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-slate-100 rounded-full">
        <Clock className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('empty.title')}</h3>
      <p className="text-sm text-slate-600 text-center max-w-md">{t('empty.description')}</p>
    </div>
  )
}
