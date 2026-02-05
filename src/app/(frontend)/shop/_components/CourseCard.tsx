'use client'

import { Card, CardContent, CardFooter, CardHeader } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { BookOpen, Check, GraduationCap } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

type IconType = 'book' | 'check' | 'graduation'
type ButtonStyle = 'purchase' | 'owned'

interface CourseCardProps {
  badge: string
  badgeColor: string
  title: string
  description: string
  price: number
  icon: IconType
  iconBgColor: string
  buttonText: string
  buttonStyle: ButtonStyle
  isOwned?: boolean
}

const iconMap = {
  book: BookOpen,
  check: Check,
  graduation: GraduationCap,
}

export function CourseCard({
  badge,
  badgeColor,
  title,
  description,
  price,
  icon,
  iconBgColor,
  buttonText,
  buttonStyle,
  isOwned = false,
}: CourseCardProps) {
  const Icon = iconMap[icon]

  const getButtonStyles = () => {
    switch (buttonStyle) {
      case 'purchase':
        return 'bg-primary text-primary-foreground hover:bg-primary/90'
      case 'owned':
        return 'bg-success/10 text-success cursor-not-allowed hover:bg-success/10 border border-success/20'
    }
  }

  return (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-4">
        <Badge variant="secondary" className={cn('w-fit text-xs font-bold', badgeColor)}>
          {badge}
        </Badge>

        <div className="mt-4 flex items-start gap-4">
          <div className={cn('p-3 rounded-xl flex-shrink-0', iconBgColor)}>
            <Icon className={cn('w-6 h-6', isOwned ? 'text-success' : 'text-primary')} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-black text-foreground leading-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">{description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-foreground">₪{price}</span>
          <span className="text-sm text-muted-foreground font-medium">/ קורס</span>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className={cn('w-full font-bold text-sm', getButtonStyles())}
          disabled={buttonStyle === 'owned'}
        >
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  )
}
