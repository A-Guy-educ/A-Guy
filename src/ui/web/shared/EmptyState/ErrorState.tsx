import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/infra/utils/ui'
import { Stack } from '../Layout/Stack'
import { Heading } from '../Typography/Heading'
import { Text } from '../Typography/Text'

/**
 * ErrorState component for displaying error messages.
 *
 * @example
 * ```tsx
 * <ErrorState
 *   title="Something went wrong"
 *   message="We couldn't load this content. Please try again."
 *   action={<Button onClick={retry}>Try Again</Button>}
 * />
 * ```
 */

export interface ErrorStateProps {
  /**
   * Error title
   */
  title?: string

  /**
   * Error message or description
   */
  message?: string

  /**
   * Optional action button or element (e.g., retry button)
   */
  action?: React.ReactNode

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Error state component with icon, title, message, and optional action.
 * Use when displaying errors, failed requests, or exceptions.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred. Please try again.',
  action,
  className,
}: ErrorStateProps) {
  return (
    <Stack gap="content-gap" align="center" className={cn('py-section-md text-center', className)}>
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <Stack gap="content-gap-sm" align="center">
        <Heading level="h3" size="heading-lg">
          {title}
        </Heading>

        {message && (
          <Text variant="muted" className="max-w-md">
            {message}
          </Text>
        )}
      </Stack>

      {action && <div className="mt-2">{action}</div>}
    </Stack>
  )
}

ErrorState.displayName = 'ErrorState'
