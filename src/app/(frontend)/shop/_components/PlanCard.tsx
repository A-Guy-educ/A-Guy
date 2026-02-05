'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { Check, X, HelpCircle, BookOpen, Layers } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

type FeatureStyle = 'enabled' | 'disabled' | 'limited'
type IconType = 'check' | 'x' | 'help' | 'book' | 'layers'
type ButtonStyle = 'current' | 'standard' | 'premium'

interface Feature {
  icon: IconType
  text: string
  style: FeatureStyle
}

interface CourseCount {
  number: number
  text: string
  color: string
  icon: IconType
}

interface PlanCardProps {
  title: string
  subtitle: string
  price: number
  period: string
  features: Feature[]
  courseCount: CourseCount
  buttonText: string
  buttonStyle: ButtonStyle
  badge?: string
  badgeColor?: string
  isBordered?: boolean
  isPremium?: boolean
}

const iconMap = {
  check: Check,
  x: X,
  help: HelpCircle,
  book: BookOpen,
  layers: Layers,
}

export function PlanCard({
  title,
  subtitle,
  price,
  period,
  features,
  courseCount,
  buttonText,
  buttonStyle,
  badge,
  badgeColor,
  isBordered = false,
  isPremium = false,
}: PlanCardProps) {
  const FeatureIcon = ({ icon }: { icon: IconType }) => {
    const Icon = iconMap[icon]
    return <Icon className="w-4 h-4" />
  }

  const getFeatureStyles = (style: FeatureStyle) => {
    switch (style) {
      case 'enabled':
        return 'text-success'
      case 'disabled':
        return 'text-muted-foreground/30'
      case 'limited':
        return 'text-warning'
    }
  }

  const getButtonStyles = () => {
    switch (buttonStyle) {
      case 'current':
        return 'bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted'
      case 'standard':
        return 'bg-card text-foreground border-2 border-border hover:bg-muted'
      case 'premium':
        return 'bg-primary text-primary-foreground hover:bg-primary/90'
    }
  }

  const CourseIcon = iconMap[courseCount.icon]

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-xl opacity-0 group-hover:opacity-100 blur transition duration-500" />
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          isBordered && 'border-2 border-primary shadow-lg',
          isPremium && 'border-primary shadow-xl',
        )}
      >
        {badge && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Badge className={cn('text-xs px-3 py-1', badgeColor)}>{badge}</Badge>
          </div>
        )}

        <CardHeader className="text-center pb-4 pt-8">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="mt-1">{subtitle}</CardDescription>

          <div className="mt-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-black text-foreground">₪{price}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {period}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {/* Features List */}
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={cn('flex-shrink-0', getFeatureStyles(feature.style))}>
                  <FeatureIcon icon={feature.icon} />
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    feature.style === 'disabled' ? 'text-muted-foreground/50' : 'text-foreground',
                  )}
                >
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Course Count */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-center gap-2">
              <CourseIcon className={cn('w-5 h-5', courseCount.color)} />
              <span className={cn('text-sm', courseCount.color)}>{courseCount.text}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-6 px-6 pb-6">
          <Button
            className={cn('w-full font-bold text-sm', getButtonStyles())}
            disabled={buttonStyle === 'current'}
          >
            {buttonText}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
