import { cn } from '@/infra/utils/ui'
import * as React from 'react'

interface PageHeaderProps {
  children: React.ReactNode
  className?: string
}

/**
 * Compact page header area — centered, constrained width.
 *
 * Used for page titles, progress bars, and contextual info above main content.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ children, className }) => (
  <div className={cn('w-full pt-5 pb-1 px-6', className)}>
    <div className="max-w-3xl mx-auto text-center">{children}</div>
  </div>
)

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

/**
 * Main content area — centered with consistent max-width and padding.
 */
const PageContent: React.FC<PageContentProps> = ({ children, className }) => (
  <main className={cn('container mx-auto px-6 py-4 max-w-3xl', className)}>{children}</main>
)

export { PageHeader, PageContent }
