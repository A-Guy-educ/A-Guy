import { BreadcrumbLink } from './BreadcrumbLink'
import { BreadcrumbSeparator } from './BreadcrumbSeparator'
import { BreadcrumbCurrent } from './BreadcrumbCurrent'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="mb-6 flex items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={index} className="flex items-center gap-2">
            {item.href ? (
              <BreadcrumbLink href={item.href} label={item.label} />
            ) : (
              <BreadcrumbCurrent label={item.label} />
            )}
            {!isLast && <BreadcrumbSeparator />}
          </div>
        )
      })}
    </nav>
  )
}
