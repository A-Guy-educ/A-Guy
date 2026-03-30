import { cn } from '@/infra/utils/ui'
import Link from 'next/link'
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/ui/web/components/breadcrumb'

export interface BreadcrumbItemType {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItemType[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <BreadcrumbRoot className={cn('mb-content-gap')}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <div key={index} className={cn('flex items-center gap-2')}>
              <BreadcrumbItem>
                {item.href ? (
                  <BreadcrumbLink asChild className={cn('transition-all duration-normal')}>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </div>
          )
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  )
}
