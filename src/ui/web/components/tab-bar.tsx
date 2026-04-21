'use client'

import { cn } from '@/infra/utils/ui'
import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

interface TabItem {
  /** Unique key for the tab */
  key: string
  /** Display label */
  label: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Accent color (CSS color string) */
  color: string
  /** URL for link-based tabs (optional — renders <a> instead of <button>) */
  href?: string
}

interface TabBarProps {
  /** Tab definitions */
  items: TabItem[]
  /** Currently active tab key (for button-mode) or current pathname (for link-mode) */
  activeKey: string
  /** Called when a tab is clicked (button-mode only) */
  onTabChange?: (key: string) => void
  /** Unique layoutId prefix to avoid framer-motion conflicts between multiple TabBars */
  layoutId?: string
  /** Max width of the tab bar container */
  maxWidth?: string
  className?: string
  /** Component to render for link tabs (e.g., SystemLink from Next.js) */
  linkComponent?: React.ComponentType<{
    href: string
    className?: string
    children: React.ReactNode
  }>
}

/**
 * Reusable tab navigation bar with icons and animated indicator.
 *
 * Supports both button-mode (onTabChange) and link-mode (href on items).
 * Renders a pill-shaped container with spring-animated active indicator and bottom bar.
 */
const TabBar: React.FC<TabBarProps> = ({
  items,
  activeKey,
  onTabChange,
  layoutId: _layoutId = 'tabBar',
  maxWidth = 'max-w-lg',
  className,
  linkComponent: LinkComponent,
}) => {
  return (
    <nav className={cn('bg-card py-2 border-b border-border/40', className)}>
      <div className={cn(maxWidth, 'mx-auto px-4')}>
        <div className="bg-muted/40 p-1 rounded-xl flex items-center justify-between">
          {items.map((item) => {
            const isActive = activeKey === item.key || activeKey === item.href
            const Icon = item.icon

            const content = (
              <>
                {isActive && (
                  <div
                    className="absolute inset-0 bg-card rounded-lg shadow-elevation-1 transition-all duration-normal"
                    style={{ zIndex: 0 }}
                  />
                )}
                <span
                  className="relative z-10 flex items-center justify-center gap-1.5"
                  style={isActive ? { color: item.color } : undefined}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive && 'stroke-[2.5]')} />
                  <span>{item.label}</span>
                </span>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full transition-all duration-normal"
                    style={{ backgroundColor: item.color, zIndex: 10 }}
                  />
                )}
              </>
            )

            const sharedClassName = cn(
              'relative flex-1 flex items-center justify-center gap-1.5 py-2 px-2 md:px-3 min-h-[44px] text-body-xs md:text-body-sm rounded-lg transition-colors active:opacity-70',
              isActive ? 'font-bold' : 'font-medium text-muted-foreground hover:text-foreground',
            )

            if (item.href && LinkComponent) {
              return (
                <LinkComponent key={item.key} href={item.href} className={sharedClassName}>
                  {content}
                </LinkComponent>
              )
            }

            return (
              <button
                key={item.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange?.(item.key)}
                className={sharedClassName}
              >
                {content}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export { TabBar }
export type { TabBarProps, TabItem }
