import * as React from 'react'
import { cn } from '@/utilities/ui'
import { Stack } from '../Layout/Stack'
import { Heading } from '../Typography/Heading'
import { Text } from '../Typography/Text'
import type { LucideIcon } from 'lucide-react'

/**
 * EmptyState component for displaying when no content is available.
 *
 * @example
 * ```tsx
 * import { Inbox } from 'lucide-react'
 *
 * <EmptyState
 *   icon={Inbox}
 *   title="No items found"
 *   description="Get started by creating your first item."
 *   action={<Button>Create Item</Button>}
 * />
 * ```
 */

export interface EmptyStateProps {
  /**
   * Icon to display (from lucide-react)
   */
  icon?: LucideIcon

  /**
   * Title text
   */
  title: string

  /**
   * Description text
   */
  description?: string

  /**
   * Optional action button or element
   */
  action?: React.ReactNode

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Empty state component with icon, title, description, and optional action.
 * Use when displaying empty lists, search results, or initial states.
 */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Stack gap="content-gap" align="center" className={cn('py-section-md text-center', className)}>
      {IconComponent && (
        <div className="rounded-full bg-muted p-4">
          <IconComponent className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <Stack gap="content-gap-sm" align="center">
        <Heading level="h3" size="heading-lg">
          {title}
        </Heading>

        {description && (
          <Text variant="muted" className="max-w-md">
            {description}
          </Text>
        )}
      </Stack>

      {action && <div className="mt-2">{action}</div>}
    </Stack>
  )
}

EmptyState.displayName = 'EmptyState'
