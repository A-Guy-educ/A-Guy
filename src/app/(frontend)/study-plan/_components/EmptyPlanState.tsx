import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Clock, Zap } from 'lucide-react'

interface EmptyPlanStateProps {
  onGenerate?: () => void
  canGenerate?: boolean
  isLoading?: boolean
}

export function EmptyPlanState({ onGenerate, canGenerate, isLoading }: EmptyPlanStateProps) {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-2xl">
      <div className="w-16 h-16 mb-4 flex items-center justify-center bg-muted rounded-full">
        <Clock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('empty.title')}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        {t('empty.description')}
      </p>
      {onGenerate && (
        <Button onClick={onGenerate} disabled={!canGenerate || isLoading} size="lg">
          <Zap className="w-5 h-5 me-2" />
          {t('generateButton')}
        </Button>
      )}
    </div>
  )
}
