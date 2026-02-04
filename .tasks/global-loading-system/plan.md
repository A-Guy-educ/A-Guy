# Global Loading System - Low-Level Implementation Plan

**Task**: Implement a system-level loading infrastructure for user-facing UI
**Scope**: `/app/(frontend)/**`, user-facing API routes, user UI components
**Out of Scope**: Payload Admin UI, admin hooks, seeds, internal ops tooling

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Step A: System Infrastructure](#3-step-a-system-infrastructure)
4. [Step B: Wire User Actions](#4-step-b-wire-user-actions)
5. [Step C: Client Fetch Wrapper](#5-step-c-client-fetch-wrapper)
6. [Step D: Loading Boundaries](#6-step-d-loading-boundaries)
7. [File Structure](#7-file-structure)
8. [Testing Strategy](#8-testing-strategy)
9. [Migration Checklist](#9-migration-checklist)

---

## 1. Current State Analysis

### Existing Loading Patterns

| Component     | Location                                                      | Current Pattern                                                                    |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| LoginForm     | `src/app/(frontend)/login/LoginForm.tsx`                      | Local `useState(false)` for `isLoading` + Suspense boundary + `LoginFormSkeleton`  |
| SignupForm    | `src/app/(frontend)/signup/SignupForm.tsx`                    | Local `useState(false)` for `isLoading` + Suspense boundary + `SignupFormSkeleton` |
| ChatInterface | `src/app/(frontend)/.../ChatInterface/index.tsx`              | Uses `isLoading` from `useNotebookChat` hook                                       |
| StudyContent  | `src/app/(frontend)/study/_components/StudyContent/index.tsx` | Local `useState(true)` for `isLoading`                                             |
| HeaderClient  | `src/ui/web/header/Component.client.tsx`                      | Uses `isAuthLoading` from `useCurrentUser` hook                                    |

### Existing Components to Leverage

| Component | Location                           | Purpose                                     |
| --------- | ---------------------------------- | ------------------------------------------- |
| Button    | `src/ui/web/components/button.tsx` | No built-in loading state (needs extension) |

> **Note**: No shared Spinner or Skeleton components exist yet. These will be created as part of this implementation.

### User-Facing Fetch Calls (4 total)

1. `src/ui/web/header/Component.client.tsx` - Uses `useCurrentUser` hook - Auth check - **NOT WIRED** (keep silent)
2. `src/infra/analytics/components/UserIdentificationTracker.tsx:42` - `fetch('/api/users/me', ...)` - Analytics auth - **NOT WIRED** (silent)
3. `src/app/(frontend)/study/_components/StudyContent/index.tsx:41` - `fetch('/api/chapters/by-grade?grade=...')` - **WIRED** via `userApiClient`
4. `ConvertButton.tsx` - `fetch('/api/exercises/import?lessonId=...')` - **NOT WIRED** (low-traffic internal tool)

### Server Actions (2 total)

1. `src/app/(frontend)/login/login_authenticate-action.ts` - Login with cookie setting
2. `src/app/(frontend)/signup/actions/signup_createUser-action.ts` - Signup with auto-login

### Provider Hierarchy (insertion point)

```
html
└── body
    └── I18nProvider
        └── Providers (src/ui/web/providers/index.tsx)
            └── ThemeProvider
                └── AnalyticsProvider
                    └── HeaderThemeProvider
                        └── [children]
```

### Import Path Convention (Updated)

The codebase uses the following import conventions:

- `@/ui/web/components/` - shadcn/ui components (button, card, input, etc.)
- `@/ui/web/providers/` - React providers (I18n, Theme, etc.)
- `@/infra/` - Infrastructure code (analytics, utils, etc.)
- `@/client/` - Client-side utilities and hooks

---

## 2. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     LoadingManager (Store)                       │
│  - operations: Map<key, {type, startTime}>                       │
│  - version: number (for snapshot immutability)                   │
│  - register(key, type) / unregister(key)                         │
│  - isBusy() / isScreenBusy() / isKeyBusy(key)                   │
│  - Direct access via useSyncExternalStore (no Context)           │
└─────────────────────────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ RouteLoading    │  │ AsyncAction     │
│ Indicator       │  │ Wrapper         │
│ (indeterminate) │  │ (server actions)│
└─────────────────┘  └─────────────────┘
        │
        ▼
┌─────────────────┐
│ SystemLink      │
│ (trigger-based) │
└─────────────────┘
```

### Loading Types

```typescript
type LoadingType = 'route' | 'screen' | 'inline' | 'action'
```

| Type     | Description               | UI Treatment             |
| -------- | ------------------------- | ------------------------ |
| `route`  | Route transition          | Top indeterminate bar    |
| `screen` | Full content area loading | Skeleton/placeholder     |
| `inline` | Small inline operation    | Local spinner            |
| `action` | User-triggered mutation   | Button spinner + disable |

---

## 3. Step A: System Infrastructure

### A.1 Create LoadingManager Store

**File**: `src/infra/loading/LoadingManager.ts`

```typescript
// Types
export type LoadingType = 'route' | 'screen' | 'inline' | 'action'

export interface LoadingOperation {
  type: LoadingType
  startTime: number
  key: string
  timeoutId?: ReturnType<typeof setTimeout>
}

export interface LoadingSnapshot {
  version: number
  operationCount: number
}

// Safety timeout for route transitions (prevents stuck state)
const ROUTE_SAFETY_TIMEOUT_MS = 15_000

// Store implementation with immutable snapshots for useSyncExternalStore
export function createLoadingManager() {
  const operations = new Map<string, LoadingOperation>()
  let version = 0
  const listeners = new Set<() => void>()

  function notify() {
    version++
    listeners.forEach((listener) => listener())
  }

  return {
    // Registration with optional safety timeout
    register(key: string, type: LoadingType): void {
      // Clear any existing timeout for this key
      const existing = operations.get(key)
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId)
      }

      const operation: LoadingOperation = { type, startTime: Date.now(), key }

      // Add safety timeout for route transitions to auto-unregister
      if (type === 'route') {
        operation.timeoutId = setTimeout(() => {
          // Auto-unregister if still present (navigation hung)
          if (operations.has(key)) {
            operations.delete(key)
            notify()
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[LoadingManager] Route transition "${key}" timed out after ${ROUTE_SAFETY_TIMEOUT_MS}ms`,
              )
            }
          }
        }, ROUTE_SAFETY_TIMEOUT_MS)
      }

      operations.set(key, operation)
      notify()
    },

    unregister(key: string): void {
      const operation = operations.get(key)
      if (operation) {
        // Clear safety timeout if exists
        if (operation.timeoutId) {
          clearTimeout(operation.timeoutId)
        }
        operations.delete(key)
        notify()
      }
    },

    // Selectors
    isBusy(): boolean {
      return operations.size > 0
    },

    isScreenBusy(): boolean {
      for (const op of operations.values()) {
        if (op.type === 'screen') return true
      }
      return false
    },

    isRouteBusy(): boolean {
      for (const op of operations.values()) {
        if (op.type === 'route') return true
      }
      return false
    },

    // Generic key check (works for any type)
    isKeyBusy(key: string): boolean {
      return operations.has(key)
    },

    getActiveOperations(): LoadingOperation[] {
      return Array.from(operations.values())
    },

    // Subscription
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // For React useSyncExternalStore - returns new object on each change
    getSnapshot(): LoadingSnapshot {
      return { version, operationCount: operations.size }
    },

    // For SSR
    getServerSnapshot(): LoadingSnapshot {
      return { version: 0, operationCount: 0 }
    },
  }
}

// Type for the manager instance (for DI in tests)
export type LoadingManagerInstance = ReturnType<typeof createLoadingManager>

// Singleton instance
export const loadingManager = createLoadingManager()
```

### A.2 Create useLoadingState Hook (Direct Store Access)

**File**: `src/infra/loading/hooks/useLoadingState.ts`

**NOTE**: No LoadingProvider context needed. We use the singleton store directly via `useSyncExternalStore`.
This is simpler, avoids re-render cascades, and eliminates context wiring complexity.

```typescript
'use client'

import { useSyncExternalStore, useCallback, useMemo } from 'react'
import { loadingManager } from '../LoadingManager'

type LoadingSelector = 'busy' | 'screen' | 'route' | { key: string }

/**
 * Hook to subscribe to specific loading states
 * Re-renders only when the specific condition changes
 */
export function useLoadingState(selector: LoadingSelector): boolean {
  // Memoize selector to avoid recreating getSnapshot on every render
  const selectorKey = useMemo(() => {
    if (typeof selector === 'string') return selector
    return `key:${selector.key}`
  }, [typeof selector === 'string' ? selector : selector.key])

  const getSnapshot = useCallback(() => {
    if (selectorKey === 'busy') {
      return loadingManager.isBusy()
    }
    if (selectorKey === 'screen') {
      return loadingManager.isScreenBusy()
    }
    if (selectorKey === 'route') {
      return loadingManager.isRouteBusy()
    }
    if (selectorKey.startsWith('key:')) {
      const key = selectorKey.slice(4)
      return loadingManager.isKeyBusy(key)
    }
    return false
  }, [selectorKey])

  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(loadingManager.subscribe, getSnapshot, getServerSnapshot)
}
```

### A.4 Create RouteLoadingIndicator Component (Trigger-Based, Indeterminate)

**File**: `src/infra/loading/components/RouteLoadingIndicator.tsx`

```typescript
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { loadingManager } from '../LoadingManager'
import { cn } from '@/infra/utils/ui'
import { LOADING_KEYS } from '../keys'

const VISIBILITY_THRESHOLD_MS = 300 // Don't show for fast navigations
const HIDE_DELAY_MS = 150 // Smooth hide transition
const MIN_VISIBLE_TIME_MS = 500 // Prevent flicker on rapid nav

/**
 * Global route loading indicator
 * - Indeterminate progress bar (no fake percentages)
 * - Only shows if navigation exceeds threshold
 * - Non-blocking (not a modal)
 * - Stuck-protection via LoadingManager safety timeout
 * - Flicker prevention via minimum visible time
 *
 * Loading is started by SystemLink/useRouterWithLoading at trigger time,
 * and ends when pathname/searchParams change (navigation completed).
 */
export function RouteLoadingIndicator() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(false)
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleSinceRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup all timers
  const clearTimers = useCallback(() => {
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
      visibilityTimeoutRef.current = null
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  // Safe hide with minimum visible time enforcement
  const scheduleHide = useCallback(() => {
    if (!isMountedRef.current) return

    // Clear any pending show timeout
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
      visibilityTimeoutRef.current = null
    }

    // Calculate how long we've been visible
    const visibleFor = visibleSinceRef.current
      ? Date.now() - visibleSinceRef.current
      : 0

    // Ensure minimum visible time to prevent flicker
    const remainingMinTime = Math.max(0, MIN_VISIBLE_TIME_MS - visibleFor)
    const totalDelay = remainingMinTime + HIDE_DELAY_MS

    hideTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsVisible(false)
        visibleSinceRef.current = null
      }
    }, totalDelay)
  }, [])

  // Watch for route loading state changes
  useEffect(() => {
    isMountedRef.current = true

    const checkVisibility = () => {
      if (!isMountedRef.current) return

      const isRouteBusy = loadingManager.isKeyBusy(LOADING_KEYS.ROUTE_TRANSITION)

      if (isRouteBusy && !isVisible) {
        // Clear any pending hide
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }

        // Delay showing to avoid flash for fast navigations
        visibilityTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          // Re-check in case navigation completed during delay
          if (loadingManager.isKeyBusy(LOADING_KEYS.ROUTE_TRANSITION)) {
            visibleSinceRef.current = Date.now()
            setIsVisible(true)
          }
        }, VISIBILITY_THRESHOLD_MS)
      } else if (!isRouteBusy && isVisible) {
        scheduleHide()
      } else if (!isRouteBusy && !isVisible) {
        // Clear pending show timeout if navigation completed quickly
        clearTimers()
      }
    }

    const unsubscribe = loadingManager.subscribe(checkVisibility)
    checkVisibility() // Initial check

    return () => {
      isMountedRef.current = false
      unsubscribe()
      clearTimers()
    }
  }, [isVisible, scheduleHide, clearTimers])

  // End route loading when navigation completes (pathname/searchParams change)
  useEffect(() => {
    loadingManager.unregister(LOADING_KEYS.ROUTE_TRANSITION)
  }, [pathname, searchParams])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      loadingManager.unregister(LOADING_KEYS.ROUTE_TRANSITION)
      clearTimers()
    }
  }, [clearTimers])

  if (!isVisible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/20 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      {/* Indeterminate animation - sliding bar */}
      <div
        className={cn(
          'h-full bg-primary w-1/3',
          'animate-[loading-slide_1.5s_ease-in-out_infinite]'
        )}
      />
      <style jsx>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
```

### A.5 Create URL Utility

**File**: `src/infra/loading/utils/resolveHref.ts`

```typescript
import type { UrlObject } from 'url'

/**
 * Resolve Next.js href (string or UrlObject) to normalized string
 * Handles edge cases: hash-only, trailing slashes, query strings
 *
 * @param ignoreHash - If true, strips hash from result (for route comparison)
 */
export function resolveHrefToString(href: string | UrlObject, ignoreHash = false): string {
  if (typeof href === 'string') {
    return normalizePathname(href, ignoreHash)
  }

  // UrlObject format
  const { pathname = '', search = '', hash = '' } = href
  const query = search.startsWith('?') ? search : search ? `?${search}` : ''
  const hashPart = ignoreHash ? '' : hash

  return normalizePathname(pathname + query + hashPart, ignoreHash)
}

/**
 * Normalize a pathname for comparison
 * - Removes trailing slashes (except root)
 * - Ensures consistent format
 * - Optionally strips hash (for route comparison)
 */
function normalizePathname(path: string, ignoreHash = false): string {
  // Handle empty/root
  if (!path || path === '/') return '/'

  // Strip hash if requested (before other processing)
  let processedPath = path
  if (ignoreHash) {
    const hashIndex = path.indexOf('#')
    if (hashIndex !== -1) {
      processedPath = path.slice(0, hashIndex)
    }
  }

  // Handle hash-only href (returns empty when ignoring hash)
  if (!processedPath || processedPath === '/') return '/'

  // Parse to extract pathname and query separately
  const [pathname, ...rest] = processedPath.split('?')
  const queryPart = rest.length > 0 ? '?' + rest.join('?') : ''

  // Remove trailing slash from pathname (unless root)
  const normalizedPathname =
    pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname

  return normalizedPathname + queryPart
}

/**
 * Build current path from Next.js hooks for comparison
 * Accepts any object with toString() (URLSearchParams, ReadonlyURLSearchParams, etc.)
 */
export function buildCurrentPath(pathname: string, searchParams: { toString(): string }): string {
  const search = searchParams.toString()
  const path = pathname + (search ? `?${search}` : '')
  return normalizePathname(path)
}
```

### A.6 Create SystemLink Component (Trigger-Based Navigation)

**File**: `src/infra/loading/components/SystemLink.tsx`

```typescript
'use client'

import React, { forwardRef, useCallback, useState } from 'react'
import Link, { type LinkProps } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/infra/utils/ui'
import { loadingManager } from '../LoadingManager'
import { LOADING_KEYS } from '../keys'
import { resolveHrefToString, buildCurrentPath } from '../utils/resolveHref'
import { useLoadingState } from '../hooks/useLoadingState'

interface SystemLinkProps extends LinkProps {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Link component that registers route loading at trigger time
 * Shows local loading indication (opacity + cursor) when clicked
 *
 * Use this for all navigation links to provide consistent loading feedback
 */
export const SystemLink = forwardRef<HTMLAnchorElement, SystemLinkProps>(function SystemLink(
  { href, onClick, children, className, ...props },
  ref,
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [wasClicked, setWasClicked] = useState(false)
  const isRouteLoading = useLoadingState({ key: LOADING_KEYS.ROUTE_TRANSITION })

  // Show loading state if this link was clicked and route is loading
  const isLoading = wasClicked && isRouteLoading

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick if provided
      onClick?.(e)

      // Don't handle if default was prevented or modifier keys
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) {
        return
      }

      // Don't handle external links
      const hrefStr = typeof href === 'string' ? href : href.pathname || ''
      if (
        hrefStr.startsWith('http://') ||
        hrefStr.startsWith('https://') ||
        hrefStr.startsWith('//')
      ) {
        return
      }

      // Don't handle hash-only links (same page anchor)
      if (hrefStr.startsWith('#') || (typeof href === 'object' && !href.pathname && href.hash)) {
        return
      }

      // Normalize both paths for reliable comparison (ignore hash - same-page anchor)
      const targetPath = resolveHrefToString(href, true)
      const currentPath = buildCurrentPath(pathname, searchParams)

      // Only register loading if actually navigating to different page
      if (currentPath !== targetPath) {
        setWasClicked(true)
        loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      }
    },
    [href, onClick, pathname, searchParams],
  )

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={cn(
        className,
        isLoading && 'opacity-60 cursor-wait pointer-events-none',
        'transition-opacity duration-150',
      )}
      aria-disabled={isLoading}
      {...props}
    >
      {children}
    </Link>
  )
})
```

### A.7 Create useRouterWithLoading Hook

**File**: `src/infra/loading/hooks/useRouterWithLoading.ts`

```typescript
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { loadingManager } from '../LoadingManager'
import { LOADING_KEYS } from '../keys'
import { resolveHrefToString, buildCurrentPath } from '../utils/resolveHref'

/**
 * Router hook that registers route loading at trigger time
 * Use this instead of useRouter for programmatic navigation with loading indicators
 */
export function useRouterWithLoading() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const push = useCallback(
    (href: string, options?: Parameters<typeof router.push>[1]) => {
      // Normalize both paths for reliable comparison (ignore hash - same-page anchor)
      const targetPath = resolveHrefToString(href, true)
      const currentPath = buildCurrentPath(pathname, searchParams)

      // Only register loading if actually navigating to different page
      if (currentPath !== targetPath) {
        loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      }

      router.push(href, options)
    },
    [router, pathname, searchParams],
  )

  const replace = useCallback(
    (href: string, options?: Parameters<typeof router.replace>[1]) => {
      // Normalize both paths for reliable comparison (ignore hash - same-page anchor)
      const targetPath = resolveHrefToString(href, true)
      const currentPath = buildCurrentPath(pathname, searchParams)

      if (currentPath !== targetPath) {
        loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      }

      router.replace(href, options)
    },
    [router, pathname, searchParams],
  )

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
    }),
    [router, push, replace],
  )
}
```

### A.8 Create AsyncAction Wrapper

**File**: `src/infra/loading/AsyncAction.ts`

```typescript
import { loadingManager, type LoadingManagerInstance } from './LoadingManager'

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: Record<string, string>
}

export interface AsyncActionOptions {
  key: string
  preventDuplicate?: boolean // Default: true
}

/**
 * Factory function for creating asyncAction with custom manager (for testing)
 */
export function createAsyncAction(manager: LoadingManagerInstance) {
  return async function asyncAction<T>(
    action: () => Promise<T>,
    options: AsyncActionOptions,
  ): Promise<ActionResult<T>> {
    const { key, preventDuplicate = true } = options

    // Check for duplicate using generic key check
    if (preventDuplicate && manager.isKeyBusy(key)) {
      return { success: false, error: 'Action already in progress' }
    }

    try {
      manager.register(key, 'action')
      const result = await action()

      // Handle server action result format
      if (result && typeof result === 'object') {
        const actionResult = result as Record<string, unknown>

        // Already has success field (our server action format)
        if ('success' in actionResult) {
          return actionResult as ActionResult<T>
        }

        // Wrap raw result
        return { success: true, data: result }
      }

      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      return { success: false, error: message }
    } finally {
      manager.unregister(key)
    }
  }
}

/**
 * Wraps an async action with loading state management
 * - Registers/unregisters loading state
 * - Prevents duplicate submissions (optional)
 * - Returns normalized result contract
 *
 * @example
 * const result = await asyncAction(
 *   () => loginAction(formData),
 *   { key: 'login' }
 * )
 */
export const asyncAction = createAsyncAction(loadingManager)
```

### A.9 Create useAsyncAction Hook

**File**: `src/infra/loading/hooks/useAsyncAction.ts`

```typescript
'use client'

import { useCallback, useMemo } from 'react'
import { asyncAction, type ActionResult, type AsyncActionOptions } from '../AsyncAction'
import { useLoadingState } from './useLoadingState'

interface UseAsyncActionReturn<T, A extends unknown[]> {
  execute: (...args: A) => Promise<ActionResult<T>>
  isLoading: boolean
}

/**
 * Hook for using async actions with loading state
 *
 * @example
 * const { execute, isLoading } = useAsyncAction(
 *   (formData: FormData) => loginAction(formData),
 *   { key: 'login' }
 * )
 *
 * async function onSubmit(e) {
 *   const result = await execute(formData)
 *   if (result.success) { ... }
 * }
 */
export function useAsyncAction<T, A extends unknown[]>(
  action: (...args: A) => Promise<T>,
  options: AsyncActionOptions,
): UseAsyncActionReturn<T, A> {
  // Use generic key selector instead of action-specific
  const isLoading = useLoadingState({ key: options.key })

  const stableOptions = useMemo(() => options, [options.key, options.preventDuplicate])

  const execute = useCallback(
    async (...args: A): Promise<ActionResult<T>> => {
      return asyncAction(() => action(...args), stableOptions)
    },
    [action, stableOptions],
  )

  return useMemo(() => ({ execute, isLoading }), [execute, isLoading])
}
```

### A.10 Create Spinner Component

**File**: `src/infra/loading/components/Spinner.tsx`

```typescript
'use client'

import { cn } from '@/infra/utils/ui'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

/**
 * Animated spinner component with size variants
 * Uses CSS animation for performance
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin', sizeClasses[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
```

### A.12 Add RouteLoadingIndicator to Layout (No Provider Needed)

**File**: `src/app/(frontend)/layout.tsx` (modify existing)

Add import and component:

```typescript
import { RouteLoadingIndicator } from '@/infra/loading/components/RouteLoadingIndicator'

// In the JSX, add RouteLoadingIndicator as first child inside Providers:
<body>
  <I18nProvider locale={locale} messages={messages}>
    <Providers>
      <RouteLoadingIndicator />
      <LayoutClient />
      <AdminBar adminBarProps={{ preview: isEnabled }} />
      <Header />
      {children}
      <Footer />
      <Toaster />
    </Providers>
  </I18nProvider>
</body>
```

### A.13 Create Module Index

**File**: `src/infra/loading/index.ts`

```typescript
// Core store (singleton + factory for testing)
export {
  loadingManager,
  createLoadingManager,
  type LoadingType,
  type LoadingOperation,
  type LoadingSnapshot,
  type LoadingManagerInstance,
} from './LoadingManager'

// Hooks (direct store access, no context needed)
export { useLoadingState } from './hooks/useLoadingState'
export { useAsyncAction } from './hooks/useAsyncAction'
export { useRouterWithLoading } from './hooks/useRouterWithLoading'

// Utilities
export {
  asyncAction,
  createAsyncAction,
  type ActionResult,
  type AsyncActionOptions,
} from './AsyncAction'
export { resolveHrefToString, buildCurrentPath } from './utils/resolveHref'

// Components
export { RouteLoadingIndicator } from './components/RouteLoadingIndicator'
export { SystemLink } from './components/SystemLink'
export { Spinner } from './components/Spinner'
// NOTE: LoadingBoundary and skeletons deferred to future task (not in this PR)

// Keys
export { LOADING_KEYS, type LoadingKey } from './keys'
```

---

## 4. Step B: Wire User Actions

### B.1 Loading Keys Registry

**File**: `src/infra/loading/keys.ts`

```typescript
/**
 * Central registry of loading keys
 * Only includes keys actually used in this task
 */
export const LOADING_KEYS = {
  // Route transitions
  ROUTE_TRANSITION: 'route:transition',

  // Auth actions (used in this task)
  LOGIN: 'auth:login',
  SIGNUP: 'auth:signup',

  // Data fetching (used in this task)
  CHAPTERS_LOAD: 'data:chapters',
} as const

export type LoadingKey = (typeof LOADING_KEYS)[keyof typeof LOADING_KEYS]

// Future keys (NOT wired in this PR - add when integrating in separate tasks):
// - LOGOUT: 'auth:logout'
// - CHAT_SEND: 'chat:send'
// - EXERCISE_IMPORT: 'exercise:import' (ConvertButton - low-traffic internal tool)
// - USER_AUTH: 'data:user-auth' (HeaderClient auth check - keep silent/inline)
```

### B.2 Refactor LoginForm

**File**: `src/app/(frontend)/login/LoginForm.tsx` (modify existing)

The current LoginForm already has:

- Local `isLoading` state with `useState`
- Suspense boundary with `LoginFormSkeleton`
- Google OAuth button
- `returnTo` query param support

Changes needed:

1. Replace local `isLoading` state with `useAsyncAction` hook
2. Replace `useRouter` with `useRouterWithLoading`
3. Add Spinner component in loading state
4. Replace `next/link` with `SystemLink` for the signup link

```typescript
'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/ui/web/components/card'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { useTranslations } from '@/ui/web/providers/I18n'
import { loginAction } from './login_authenticate-action'
import { useAsyncAction } from '@/infra/loading/hooks/useAsyncAction'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Spinner } from '@/infra/loading/components/Spinner'

function LoginFormContent() {
  const t = useTranslations('auth.login')
  const tOauth = useTranslations('auth.oauth')
  const router = useRouterWithLoading()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { execute: executeLogin, isLoading } = useAsyncAction(
    (formData: FormData) => loginAction(formData),
    { key: LOADING_KEYS.LOGIN }
  )

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const result = await executeLogin(formData)

    if (result.success) {
      window.dispatchEvent(new Event('auth:changed'))
      router.push(returnTo)
      router.refresh()
      return
    }

    // Handle error from result
    const serverResult = result.data as { error?: string } | undefined
    setError(serverResult?.error || result.error || 'invalidCredentials')
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {tOauth('orDivider')}
              </span>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}

          <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t('loggingIn')}
              </>
            ) : (
              t('loginButton')
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <SystemLink href="/signup" className="text-primary hover:underline">
            {t('signupLink')}
          </SystemLink>
        </p>
      </CardFooter>
    </Card>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginFormContent />
    </Suspense>
  )
}

function LoginFormSkeleton() {
  // ... existing skeleton implementation
}
```

### B.3 Refactor SignupForm

**File**: `src/app/(frontend)/signup/SignupForm.tsx` (modify existing)

The current SignupForm already has:

- Local `isLoading` state with `useState`
- Suspense boundary with `SignupFormSkeleton`
- Google OAuth button
- System event bus for analytics (`SYSTEM_EVENTS.REGISTRATION_COMPLETED`, `SYSTEM_EVENTS.USER_RESOLVED`)
- `identify()` call for Mixpanel
- `returnTo` query param support

Changes needed:

1. Replace local `isLoading` state with `useAsyncAction` hook
2. Replace `useRouter` with `useRouterWithLoading`
3. Add Spinner component in loading state
4. Replace `next/link` with `SystemLink` for the login link

```typescript
'use client'

import React, { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { detectBrowserLocale } from '@/i18n/config'
import { identify } from '@/infra/analytics/core/tracker'
import { updateCachedUserProperties } from '@/infra/analytics/utils/user-properties-cache'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SignupFormFields } from './SignupFormFields'
import { signupAction } from './actions/signup_createUser-action'
import { validateSignupForm } from './actions/signup_validation-action'
import { useAsyncAction } from '@/infra/loading/hooks/useAsyncAction'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Spinner } from '@/infra/loading/components/Spinner'

function SignupFormContent() {
  const t = useTranslations('auth.signup')
  const tOauth = useTranslations('auth.oauth')
  const router = useRouterWithLoading()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { execute: executeSignup, isLoading } = useAsyncAction(
    (formData: FormData) => signupAction(formData),
    { key: LOADING_KEYS.SIGNUP }
  )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})

    const formData = new FormData(event.currentTarget)

    // Client-side validation
    const clientErrors = validateSignupForm(formData, t)

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    const result = await executeSignup(formData)

    if (!result.success) {
      // Handle errors from the action result
      const actionData = result.data as { errors?: Record<string, string>; message?: string } | undefined
      if (actionData?.errors) {
        setErrors(actionData.errors)
      }
      toast.error(actionData?.message || result.error || 'Signup failed')
      return
    }

    // Success path
    const successData = result.data as { userId?: string; message?: string; success?: boolean } | undefined
    toast.success('Account created successfully!')

    // Track registration completed and user resolved
    if (successData?.userId) {
      systemEventBus.emit(SYSTEM_EVENTS.REGISTRATION_COMPLETED, {
        user_id: successData.userId,
        auth_method: 'email',
      })

      // Track user_resolved with enriched user properties
      const userProperties: Record<string, unknown> = {
        user_id: successData.userId,
        is_new_user: true,
        signup_date: new Date().toISOString(),
        role: 'student',
      }

      // Add email and name from form (using Mixpanel reserved properties)
      const email = formData.get('email') as string
      const name = formData.get('name') as string
      if (email) userProperties.$email = email
      if (name) userProperties.$name = name

      // Add locale from browser
      if (typeof window !== 'undefined') {
        userProperties.locale = detectBrowserLocale()
      }

      // Cache user properties for future sessions
      updateCachedUserProperties(userProperties)

      // Emit user_resolved event via system event bus
      systemEventBus.emit(SYSTEM_EVENTS.USER_RESOLVED, {
        user_id: successData.userId,
        is_anonymous: false,
      })

      // Call identify() to ensure Mixpanel People properties are set
      identify(successData.userId, userProperties)
    }

    // Auto-login successful - redirect to returnTo
    router.push(returnTo)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">
          Fill in the form below to create your account
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {tOauth('orDivider')}
              </span>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <SignupFormFields t={t} isLoading={isLoading} errors={errors} />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t('creatingAccount')}
              </>
            ) : (
              t('createAccount')
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <SystemLink href="/login" className="text-primary hover:underline">
            {t('login')}
          </SystemLink>
        </p>
      </CardFooter>
    </Card>
  )
}

export function SignupForm() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupFormContent />
    </Suspense>
  )
}

function SignupFormSkeleton() {
  // ... existing skeleton implementation
}
```

---

## 5. Step C: Client Fetch Wrapper

### C.1 Create userApiClient (with safe JSON parsing)

**File**: `src/infra/loading/userApiClient.ts`

```typescript
import { loadingManager, type LoadingType } from './LoadingManager'

/**
 * Get user-friendly error message for HTTP status codes
 * Avoids exposing raw server HTML/text to users
 */
function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request'
    case 401:
      return 'Not authenticated'
    case 403:
      return 'Access denied'
    case 404:
      return 'Not found'
    case 429:
      return 'Too many requests'
    case 500:
      return 'Server error'
    case 502:
      return 'Bad gateway'
    case 503:
      return 'Service unavailable'
    default:
      return `Request failed (${status})`
  }
}

export interface FetchOptions extends RequestInit {
  loadingKey?: string
  loadingType?: LoadingType
  timeout?: number // Default: 30000ms
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

const DEFAULT_TIMEOUT = 30000

/**
 * User-facing API client with loading state management
 *
 * @example
 * const { data, error } = await userApiClient<User>('/api/users/me', {
 *   loadingKey: LOADING_KEYS.USER_AUTH,
 *   credentials: 'include'
 * })
 */
export async function userApiClient<T>(
  url: string,
  options: FetchOptions = {},
): Promise<ApiResponse<T>> {
  const { loadingKey, loadingType = 'inline', timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options

  // Register loading if key provided
  if (loadingKey) {
    loadingManager.register(loadingKey, loadingType)
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle HTTP errors - return user-friendly message, not raw HTML
    if (!response.ok) {
      // Try to get JSON error first
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        try {
          const errorData = await response.json()
          // Use error message from JSON if available
          const message =
            errorData?.message || errorData?.error || getHttpErrorMessage(response.status)
          return { data: null, error: message, status: response.status }
        } catch {
          // JSON parse failed, fall through to default
        }
      }
      // Return stable user-friendly error (not raw HTML)
      return {
        data: null,
        error: getHttpErrorMessage(response.status),
        status: response.status,
      }
    }

    // Safe JSON parsing - check content-type first
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await response.json()
        return {
          data,
          error: null,
          status: response.status,
        }
      } catch {
        // JSON parsing failed despite content-type
        return {
          data: null,
          error: 'Invalid JSON response',
          status: response.status,
        }
      }
    }

    // Non-JSON response - try to get text for debugging
    const text = await response.text().catch(() => '')

    // If empty response, treat as success with null data
    if (!text) {
      return {
        data: null,
        error: null,
        status: response.status,
      }
    }

    // Non-JSON with content - return as error for debugging
    return {
      data: null,
      error: `Unexpected response type: ${contentType || 'unknown'}`,
      status: response.status,
    }
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        data: null,
        error: 'Request timeout',
        status: 408,
      }
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : 'An error occurred'
    return {
      data: null,
      error: message,
      status: 0,
    }
  } finally {
    if (loadingKey) {
      loadingManager.unregister(loadingKey)
    }
  }
}

/**
 * Hook-friendly version for use in components
 */
export function createApiRequest<T>(
  url: string,
  options: FetchOptions = {},
): () => Promise<ApiResponse<T>> {
  return () => userApiClient<T>(url, options)
}
```

### C.2 Refactor StudyContent Fetch

**File**: `src/app/(frontend)/study/_components/StudyContent/index.tsx` (modify existing)

The current StudyContent already has:

- Local `isLoading` state with `useState(true)`
- Simple loading text display

Changes needed:

1. Replace local `isLoading` state with `useLoadingState` hook
2. Replace direct `fetch` with `userApiClient`
3. Add proper skeleton loading UI

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import {
  DEFAULT_LESSON_TYPE,
  getEffectiveLessonType,
  type LessonType,
} from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { Chapter, Lesson } from '@/payload-types'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'
import { LessonCard } from '@/app/(frontend)/courses/_components/LessonCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { logger } from '@/infra/utils/logger'
import { userApiClient } from '@/infra/loading/userApiClient'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { useLoadingState } from '@/infra/loading/hooks/useLoadingState'

interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

interface ChaptersResponse {
  chapters: ChapterWithLessons[]
  courseSlug: string
}

interface StudyContentProps {
  lessonType?: LessonType
}

export function StudyContent({ lessonType = DEFAULT_LESSON_TYPE }: StudyContentProps) {
  const t = useTranslations('study')
  const [chapters, setChapters] = useState<ChapterWithLessons[]>([])
  const [courseSlug, setCourseSlug] = useState<string>('')
  const [hasLoaded, setHasLoaded] = useState(false)

  // Use generic key selector
  const isLoading = useLoadingState({ key: LOADING_KEYS.CHAPTERS_LOAD })

  useEffect(() => {
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      const { data, error } = await userApiClient<ChaptersResponse>(
        `/api/chapters/by-grade?grade=${profile.gradeLevel}`,
        {
          loadingKey: LOADING_KEYS.CHAPTERS_LOAD,
          loadingType: 'screen',
          credentials: 'include',
          cache: 'no-store',
        }
      )

      if (error) {
        logger.error({ err: new Error(error) }, 'Failed to load chapters')
      } else if (data) {
        setChapters(data.chapters || [])
        setCourseSlug(data.courseSlug || '')
      }

      setHasLoaded(true)
    }

    loadData()
  }, [])

  if (!hasLoaded || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="space-y-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const filteredChapters = chapters
    .map((chapter) => {
      const filteredLessons = (chapter.lessons ?? []).filter(
        (lesson) => getEffectiveLessonType(lesson.type) === lessonType,
      )
      return { ...chapter, lessons: filteredLessons }
    })
    .filter((chapter) => chapter.lessons.length > 0)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('studyTopics')}</h1>
      {filteredChapters.length > 0 ? (
        <div className="space-y-12">
          {filteredChapters.map((chapter) => {
            const chapterSlug = chapter.slug
            if (!chapterSlug) return null

            return (
              <section key={chapter.id}>
                <ChapterHeader
                  chapterLabel={chapter.chapterLabel}
                  title={chapter.title}
                  description={chapter.description}
                />
                <div className="space-y-3">
                  {chapter.lessons.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      courseSlug={courseSlug}
                      chapterSlug={chapterSlug}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <EmptyState type="noLessons" />
      )}
    </div>
  )
}
```

---

## 6. Step D: Loading Boundaries (DEFERRED - Not in This PR)

> **NOTE**: LoadingBoundary and skeleton components are deferred to a future task.
> This PR focuses on: route indicator, login/signup forms, fetch wrapper.

### D.1 Create LoadingBoundary Component (with timer cleanup) - FUTURE

**File**: `src/lib/loading/components/LoadingBoundary.tsx`

```typescript
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { loadingManager } from '../LoadingManager'
import { Skeleton } from '@/components/shared/Loading/Skeleton'
import { cn } from '@/infra/utils/ui'

interface LoadingBoundaryProps {
  children: React.ReactNode
  loadingKey: string
  fallback?: React.ReactNode
  className?: string
  /**
   * Minimum time to show loading state (prevents flash)
   */
  minDisplayTime?: number
}

/**
 * Loading boundary component for heavy content regions
 * Wraps content and shows fallback while loading
 *
 * @example
 * <LoadingBoundary loadingKey="pdf-viewer" fallback={<PdfSkeleton />}>
 *   <PdfViewer />
 * </LoadingBoundary>
 */
export function LoadingBoundary({
  children,
  loadingKey,
  fallback,
  className,
  minDisplayTime = 0,
}: LoadingBoundaryProps) {
  const [isLoading, setIsLoading] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const minDisplayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup function for timers
  const clearTimers = useCallback(() => {
    if (minDisplayTimeoutRef.current) {
      clearTimeout(minDisplayTimeoutRef.current)
      minDisplayTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const checkLoading = () => {
      if (!isMountedRef.current) return

      // Use generic isKeyBusy (works for any loading type)
      const busy = loadingManager.isKeyBusy(loadingKey)

      if (busy && !isLoading) {
        startTimeRef.current = Date.now()
        setIsLoading(true)
      } else if (!busy && isLoading) {
        // Ensure minimum display time
        const elapsed = Date.now() - (startTimeRef.current || 0)
        const remaining = Math.max(0, minDisplayTime - elapsed)

        if (remaining > 0) {
          clearTimers()
          minDisplayTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setIsLoading(false)
            }
          }, remaining)
        } else {
          setIsLoading(false)
        }
      }
    }

    const unsubscribe = loadingManager.subscribe(checkLoading)
    checkLoading() // Initial check

    return () => {
      isMountedRef.current = false
      unsubscribe()
      clearTimers()
    }
  }, [loadingKey, isLoading, minDisplayTime, clearTimers])

  const defaultFallback = (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  )

  if (isLoading) {
    return <div className={cn(className)}>{fallback || defaultFallback}</div>
  }

  return <div className={cn(className)}>{children}</div>
}
```

### D.2 Create Content-Specific Skeletons

**File**: `src/lib/loading/components/skeletons/ChatSkeleton.tsx`

```typescript
import { Skeleton } from '@/components/shared/Loading/Skeleton'

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Messages area skeleton */}
      <div className="flex-1 p-5 space-y-4">
        {/* AI message */}
        <div className="mr-auto max-w-[85%]">
          <Skeleton className="h-16 w-64 rounded-[20px] rounded-br-[4px]" />
        </div>
        {/* User message */}
        <div className="ml-auto max-w-[85%]">
          <Skeleton className="h-12 w-48 rounded-[20px] rounded-bl-[4px]" />
        </div>
        {/* AI message */}
        <div className="mr-auto max-w-[85%]">
          <Skeleton className="h-20 w-72 rounded-[20px] rounded-br-[4px]" />
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="flex-shrink-0 bg-card border-t border-border p-5 pb-8">
        <Skeleton className="h-12 w-full rounded-[30px]" />
      </div>
    </div>
  )
}
```

**File**: `src/lib/loading/components/skeletons/StudySkeleton.tsx`

```typescript
import { Skeleton } from '@/components/shared/Loading/Skeleton'

export function StudySkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-10 w-64 mb-8" />
      <div className="space-y-12">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**File**: `src/lib/loading/components/skeletons/index.ts`

```typescript
export { ChatSkeleton } from './ChatSkeleton'
export { StudySkeleton } from './StudySkeleton'
```

---

## 7. File Structure

```
src/infra/loading/
├── index.ts                          # Public API exports
├── LoadingManager.ts                 # Core state management store (singleton + factory)
├── AsyncAction.ts                    # Action wrapper utility (with DI factory)
├── userApiClient.ts                  # Fetch wrapper for user API calls
├── keys.ts                           # Loading key constants
├── utils/
│   └── resolveHref.ts                # URL normalization utility
├── hooks/
│   ├── useLoadingState.ts            # Subscribe to loading state (direct store access)
│   ├── useAsyncAction.ts             # Hook for async actions
│   └── useRouterWithLoading.ts       # Router hook with loading
└── components/
    ├── RouteLoadingIndicator.tsx     # Indeterminate top bar (thin, never blocks UI)
    ├── SystemLink.tsx                # Trigger-based Link wrapper (URL normalized)
    └── Spinner.tsx                   # Animated spinner component with size variants

NOTE: No LoadingProvider.tsx - we use direct store access via useSyncExternalStore.
NOTE: LoadingBoundary and skeletons deferred to future task (not in this PR).
```

---

## 8. Testing Strategy

### Unit Tests

**File**: `tests/int/loading/LoadingManager.int.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLoadingManager } from '@/infra/loading/LoadingManager'

describe('LoadingManager', () => {
  let manager: ReturnType<typeof createLoadingManager>

  beforeEach(() => {
    manager = createLoadingManager()
  })

  describe('register/unregister', () => {
    it('should register a loading operation', () => {
      manager.register('test-key', 'action')
      expect(manager.isBusy()).toBe(true)
      expect(manager.isKeyBusy('test-key')).toBe(true)
    })

    it('should unregister a loading operation', () => {
      manager.register('test-key', 'action')
      manager.unregister('test-key')
      expect(manager.isBusy()).toBe(false)
      expect(manager.isKeyBusy('test-key')).toBe(false)
    })

    it('should increment version on each change', () => {
      const v1 = manager.getSnapshot().version
      manager.register('key1', 'action')
      const v2 = manager.getSnapshot().version
      manager.unregister('key1')
      const v3 = manager.getSnapshot().version

      expect(v2).toBe(v1 + 1)
      expect(v3).toBe(v2 + 1)
    })

    it('should not increment version on no-op unregister', () => {
      const v1 = manager.getSnapshot().version
      manager.unregister('nonexistent')
      const v2 = manager.getSnapshot().version

      expect(v2).toBe(v1)
    })
  })

  describe('selectors', () => {
    it('isBusy should return true if any operation is active', () => {
      expect(manager.isBusy()).toBe(false)
      manager.register('key1', 'action')
      expect(manager.isBusy()).toBe(true)
    })

    it('isScreenBusy should only return true for screen type', () => {
      manager.register('action-key', 'action')
      expect(manager.isScreenBusy()).toBe(false)

      manager.register('screen-key', 'screen')
      expect(manager.isScreenBusy()).toBe(true)
    })

    it('isRouteBusy should only return true for route type', () => {
      manager.register('action-key', 'action')
      expect(manager.isRouteBusy()).toBe(false)

      manager.register('route-key', 'route')
      expect(manager.isRouteBusy()).toBe(true)
    })

    it('isKeyBusy should check specific key regardless of type', () => {
      manager.register('key1', 'action')
      manager.register('key2', 'screen')
      manager.register('key3', 'route')

      expect(manager.isKeyBusy('key1')).toBe(true)
      expect(manager.isKeyBusy('key2')).toBe(true)
      expect(manager.isKeyBusy('key3')).toBe(true)
      expect(manager.isKeyBusy('key4')).toBe(false)
    })
  })

  describe('subscription', () => {
    it('should notify listeners on state change', () => {
      let notified = false
      manager.subscribe(() => {
        notified = true
      })

      manager.register('key', 'action')
      expect(notified).toBe(true)
    })

    it('should allow unsubscription', () => {
      let count = 0
      const unsubscribe = manager.subscribe(() => {
        count++
      })

      manager.register('key1', 'action')
      expect(count).toBe(1)

      unsubscribe()
      manager.register('key2', 'action')
      expect(count).toBe(1) // Should not increment
    })

    it('should not double-notify after manual unregister', () => {
      vi.useFakeTimers()

      let notifyCount = 0
      manager.subscribe(() => {
        notifyCount++
      })

      // Register route (triggers timeout setup)
      manager.register('route-key', 'route')
      expect(notifyCount).toBe(1)

      // Manual unregister before timeout
      manager.unregister('route-key')
      expect(notifyCount).toBe(2)

      // Fast-forward past safety timeout
      vi.advanceTimersByTime(15_001)

      // Should NOT have triggered another notify (timeout was cleared)
      expect(notifyCount).toBe(2)

      vi.useRealTimers()
    })
  })

  describe('snapshot immutability', () => {
    it('should return different snapshot objects on change', () => {
      const snap1 = manager.getSnapshot()
      manager.register('key', 'action')
      const snap2 = manager.getSnapshot()

      expect(snap1).not.toBe(snap2)
      expect(snap1.version).not.toBe(snap2.version)
    })
  })

  describe('safety timeout', () => {
    it('should auto-unregister route after timeout', async () => {
      vi.useFakeTimers()

      manager.register('route-key', 'route')
      expect(manager.isKeyBusy('route-key')).toBe(true)

      // Fast-forward past safety timeout (15s + 1ms to avoid edge timing)
      vi.advanceTimersByTime(15_001)

      expect(manager.isKeyBusy('route-key')).toBe(false)

      vi.useRealTimers()
    })

    it('should not auto-unregister non-route types', async () => {
      vi.useFakeTimers()

      manager.register('action-key', 'action')
      expect(manager.isKeyBusy('action-key')).toBe(true)

      // Fast-forward past safety timeout (15s + 1ms)
      vi.advanceTimersByTime(15_001)

      // Action should still be busy (no auto-timeout)
      expect(manager.isKeyBusy('action-key')).toBe(true)

      vi.useRealTimers()
    })

    it('should clear timeout on manual unregister', async () => {
      vi.useFakeTimers()

      manager.register('route-key', 'route')
      manager.unregister('route-key')

      // Fast-forward past timeout (15s + 1ms)
      vi.advanceTimersByTime(15_001)

      // Should not throw or re-unregister
      expect(manager.isKeyBusy('route-key')).toBe(false)

      vi.useRealTimers()
    })
  })
})
```

**File**: `tests/int/loading/resolveHref.int.spec.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { resolveHrefToString, buildCurrentPath } from '@/infra/loading/utils/resolveHref'

describe('resolveHrefToString', () => {
  it('should handle string paths', () => {
    expect(resolveHrefToString('/about')).toBe('/about')
    expect(resolveHrefToString('/about/')).toBe('/about')
    expect(resolveHrefToString('/')).toBe('/')
  })

  it('should handle paths with query strings', () => {
    expect(resolveHrefToString('/search?q=test')).toBe('/search?q=test')
    expect(resolveHrefToString('/search/?q=test')).toBe('/search?q=test')
  })

  it('should handle UrlObject format', () => {
    expect(resolveHrefToString({ pathname: '/about' })).toBe('/about')
    expect(resolveHrefToString({ pathname: '/about/' })).toBe('/about')
    expect(resolveHrefToString({ pathname: '/search', search: '?q=test' })).toBe('/search?q=test')
    expect(resolveHrefToString({ pathname: '/search', search: 'q=test' })).toBe('/search?q=test')
  })

  it('should handle hash-only hrefs', () => {
    expect(resolveHrefToString('#section')).toBe('#section')
    expect(resolveHrefToString({ hash: '#section' })).toBe('#section')
  })

  it('should handle complex UrlObject', () => {
    expect(
      resolveHrefToString({
        pathname: '/page',
        search: '?a=1&b=2',
        hash: '#section',
      }),
    ).toBe('/page?a=1&b=2#section')
  })

  describe('with ignoreHash=true', () => {
    it('should strip hash from string paths', () => {
      expect(resolveHrefToString('/page#section', true)).toBe('/page')
      expect(resolveHrefToString('/page?q=1#section', true)).toBe('/page?q=1')
    })

    it('should strip hash from UrlObject', () => {
      expect(
        resolveHrefToString(
          {
            pathname: '/page',
            hash: '#section',
          },
          true,
        ),
      ).toBe('/page')
      expect(
        resolveHrefToString(
          {
            pathname: '/page',
            search: '?q=1',
            hash: '#section',
          },
          true,
        ),
      ).toBe('/page?q=1')
    })

    it('should return root for hash-only hrefs', () => {
      expect(resolveHrefToString('#section', true)).toBe('/')
      expect(resolveHrefToString({ hash: '#section' }, true)).toBe('/')
    })
  })
})

describe('buildCurrentPath', () => {
  it('should build path from pathname and searchParams', () => {
    const searchParams = new URLSearchParams()
    expect(buildCurrentPath('/about', searchParams)).toBe('/about')
  })

  it('should include query string when present', () => {
    const searchParams = new URLSearchParams('q=test')
    expect(buildCurrentPath('/search', searchParams)).toBe('/search?q=test')
  })

  it('should normalize trailing slashes', () => {
    const searchParams = new URLSearchParams()
    expect(buildCurrentPath('/about/', searchParams)).toBe('/about')
  })
})
```

**File**: `tests/int/loading/asyncAction.int.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLoadingManager } from '@/infra/loading/LoadingManager'

/**
 * Testing strategy: Use dependency injection pattern
 *
 * Instead of mocking the singleton (which has timing issues with vi.mock/vi.doMock),
 * we test the factory function directly with fresh instances per test.
 *
 * For integration tests that need the real singleton, we can:
 * 1. Use the exported createLoadingManager factory
 * 2. Test the asyncAction function with a custom manager via DI
 */

// Import the factory to create asyncAction with custom manager
import { createAsyncAction } from '@/infra/loading/AsyncAction'

describe('asyncAction', () => {
  let testManager: ReturnType<typeof createLoadingManager>
  let asyncAction: ReturnType<typeof createAsyncAction>

  beforeEach(() => {
    testManager = createLoadingManager()
    asyncAction = createAsyncAction(testManager)
  })

  it('should return success result for successful action', async () => {
    const action = vi.fn().mockResolvedValue({ success: true, data: 'test' })

    const result = await asyncAction(action, { key: 'test' })

    expect(result.success).toBe(true)
    expect(action).toHaveBeenCalled()
  })

  it('should prevent duplicate submissions when enabled', async () => {
    const action = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
      )

    // Start first action
    const promise1 = asyncAction(action, { key: 'test', preventDuplicate: true })

    // Attempt second action immediately
    const result2 = await asyncAction(action, { key: 'test', preventDuplicate: true })

    // Second should fail
    expect(result2.success).toBe(false)
    expect(result2.error).toBe('Action already in progress')

    // Wait for first to complete
    await promise1
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('should handle errors gracefully', async () => {
    const action = vi.fn().mockRejectedValue(new Error('Test error'))

    const result = await asyncAction(action, { key: 'test' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Test error')
  })

  it('should register and unregister loading state', async () => {
    let loadingDuringAction = false
    const action = vi.fn().mockImplementation(() => {
      loadingDuringAction = testManager.isKeyBusy('test')
      return Promise.resolve({ success: true })
    })

    await asyncAction(action, { key: 'test' })

    expect(loadingDuringAction).toBe(true)
    expect(testManager.isKeyBusy('test')).toBe(false)
  })
})
```

### Integration Tests for Auth Forms

**File**: `tests/int/loading/authForms.int.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLoadingManager } from '@/infra/loading/LoadingManager'
import { createAsyncAction } from '@/infra/loading/AsyncAction'
import { LOADING_KEYS } from '@/infra/loading/keys'

describe('Auth Form Loading Integration', () => {
  let testManager: ReturnType<typeof createLoadingManager>
  let asyncAction: ReturnType<typeof createAsyncAction>

  beforeEach(() => {
    // Create fresh manager and asyncAction for each test
    testManager = createLoadingManager()
    asyncAction = createAsyncAction(testManager)
  })

  it('login action should show loading during execution', async () => {
    const states: boolean[] = []

    // Subscribe to capture state changes
    testManager.subscribe(() => {
      states.push(testManager.isKeyBusy(LOADING_KEYS.LOGIN))
    })

    // Simulate login action with delay
    const mockLoginAction = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { success: true }
    })

    await asyncAction(mockLoginAction, { key: LOADING_KEYS.LOGIN })

    // Should have been true during execution, false after
    expect(states).toContain(true)
    expect(states[states.length - 1]).toBe(false)
  })

  it('should prevent rapid double-submission', async () => {
    const mockAction = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return { success: true }
    })

    // Fire two actions rapidly
    const p1 = asyncAction(mockAction, { key: LOADING_KEYS.SIGNUP })
    const p2 = asyncAction(mockAction, { key: LOADING_KEYS.SIGNUP })

    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(false)
    expect(r2.error).toBe('Action already in progress')
    expect(mockAction).toHaveBeenCalledTimes(1)
  })
})
```

### E2E Tests

**File**: `tests/e2e/loading/route-indicator.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Route Loading Indicator', () => {
  /**
   * Test strategy: Use a dedicated test route that artificially delays
   * This is more reliable than intercepting RSC requests which can be flaky
   */

  test('should show indeterminate indicator on navigation trigger', async ({ page }) => {
    await page.goto('/')

    // Use actual link selectors from the header navigation
    const loginLink = page.locator('a[href="/login"]')

    if (await loginLink.isVisible()) {
      // Click and immediately check for loading registration
      await loginLink.click()

      // Wait for navigation to complete
      await page.waitForURL('**/login')

      // For fast navigations, verify indicator doesn't flash
      // by checking visibility after navigation completes
      await page.waitForLoadState('networkidle')
    }
  })

  test('should not show indicator for very fast navigations', async ({ page }) => {
    await page.goto('/login')

    // Navigate to another fast page
    const signupLink = page.locator('a[href="/signup"]')
    if (await signupLink.isVisible()) {
      await signupLink.click()

      // Wait for navigation to complete
      await page.waitForURL('**/signup')

      // Progress bar should NOT be visible (nav was fast)
      await expect(page.locator('[role="progressbar"]')).not.toBeVisible()
    }
  })

  test('should hide indicator after navigation completes', async ({ page }) => {
    await page.goto('/')

    const loginLink = page.locator('a[href="/login"]')
    if (await loginLink.isVisible()) {
      await loginLink.click()

      // Wait for navigation to complete
      await page.waitForURL('**/login')

      // Give any visible indicator time to hide
      await page.waitForTimeout(700) // Threshold + hide delay + margin

      // Indicator should be hidden after navigation
      await expect(page.locator('[role="progressbar"]')).not.toBeVisible()
    }
  })
})

/**
 * NOTE: For testing slow navigation specifically, consider adding a test route:
 *
 * File: src/app/(frontend)/test-slow-nav/page.tsx (only in development)
 *
 * export default async function TestSlowNavPage() {
 *   if (process.env.NODE_ENV === 'production') {
 *     notFound()
 *   }
 *   await new Promise(r => setTimeout(r, 1000))
 *   return <div>Slow page loaded</div>
 * }
 *
 * This provides deterministic slow navigation without flaky RSC interception.
 */
```

**File**: `tests/e2e/loading/auth-forms.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Auth Form Loading States', () => {
  test('login form should show loading state and prevent interaction', async ({ page }) => {
    await page.goto('/login')

    // Fill form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')

    // Get submit button
    const submitButton = page.locator('button[type="submit"]')

    // Click submit
    await submitButton.click()

    // Button should be disabled immediately (loading started)
    // Note: Server actions don't go through /api routes, so we can't intercept them
    // Instead, we verify the button state changes
    await expect(submitButton).toBeDisabled({ timeout: 100 })

    // Should contain loading text
    await expect(submitButton).toContainText(/logging in/i)
  })

  test('signup form should show loading state', async ({ page }) => {
    await page.goto('/signup')

    // Fill form with valid data
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="password"]', 'Password123!')
    await page.fill('input[name="confirmPassword"]', 'Password123!')

    // Get submit button
    const submitButton = page.locator('button[type="submit"]')

    // Click submit
    await submitButton.click()

    // Button should be disabled
    await expect(submitButton).toBeDisabled({ timeout: 100 })

    // Spinner should be visible
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 100 })
  })

  test('rapid clicks on login should not trigger multiple submissions', async ({ page }) => {
    await page.goto('/login')

    // Fill form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')

    const submitButton = page.locator('button[type="submit"]')

    // Rapid clicks
    await submitButton.click()
    await submitButton.click({ force: true })
    await submitButton.click({ force: true })

    // Button should be disabled after first click
    await expect(submitButton).toBeDisabled()

    // Only one loading indicator should show (not stacked)
    const spinners = page.locator('[role="status"]')
    await expect(spinners).toHaveCount(1)
  })
})
```

---

## 9. SystemLink Manual Migration (Minimal Scope)

**NO ESLint rule or codemod in this task** - that's scope creep and high risk.

Update only these **known user-facing navigation hotspots** to use `SystemLink`:

- [ ] `src/ui/web/header/Nav/index.tsx` - Login and Signup button links (lines 87-91)
- [ ] `src/app/(frontend)/login/LoginForm.tsx` - Signup link in footer
- [ ] `src/app/(frontend)/signup/SignupForm.tsx` - Login link in footer

**Note**: The header's main nav uses `CMSLink` component which is dynamically rendered from CMS data. The login/signup buttons are the primary user-facing links to migrate.

**Future task** (not this PR): Consider broader SystemLink adoption with proper review.

---

## 10. Migration Checklist

### Phase 1: Infrastructure (Step A)

- [ ] Create `src/infra/loading/LoadingManager.ts` (with version-based snapshots + safety timeout)
- [ ] Create `src/infra/loading/hooks/useLoadingState.ts` (direct store access, no context)
- [ ] Create `src/infra/loading/AsyncAction.ts` (with DI factory for testing)
- [ ] Create `src/infra/loading/hooks/useAsyncAction.ts`
- [ ] Create `src/infra/loading/hooks/useRouterWithLoading.ts`
- [ ] Create `src/infra/loading/utils/resolveHref.ts` (URL normalization)
- [ ] Create `src/infra/loading/components/RouteLoadingIndicator.tsx` (thin top bar only)
- [ ] Create `src/infra/loading/components/SystemLink.tsx` (trigger-based)
- [ ] Create `src/infra/loading/components/Spinner.tsx` (animated spinner with size variants)
- [ ] Create `src/infra/loading/keys.ts` (only keys used in this task)
- [ ] Create `src/infra/loading/index.ts`
- [ ] Update `src/app/(frontend)/layout.tsx` to include `RouteLoadingIndicator`
- [ ] Add unit tests for `LoadingManager` (including snapshot immutability + safety timeout)
- [ ] Run `pnpm typecheck` - verify no type errors
- [ ] Run `pnpm lint` - verify no lint errors
- [ ] Run `pnpm test:int` - verify unit tests pass

### Phase 2: Wire Actions (Step B)

- [ ] Refactor `src/app/(frontend)/login/LoginForm.tsx` to use `useAsyncAction`
- [ ] Refactor `src/app/(frontend)/signup/SignupForm.tsx` to use `useAsyncAction`
- [ ] Update both forms to use `useRouterWithLoading`
- [ ] Update `LoginForm` to show `Spinner` in button during loading
- [ ] Update `SignupForm` to show `Spinner` in button during loading
- [ ] Verify login form prevents double submission
- [ ] Verify signup form prevents double submission
- [ ] Add integration tests for auth form loading states

### Phase 3: Fetch Wrapper (Step C)

- [ ] Create `src/infra/loading/userApiClient.ts` (with safe JSON parsing)
- [ ] Refactor `StudyContent` to use `userApiClient`
- [ ] Update `StudyContent` to use proper skeleton loading
- [ ] Verify loading state shows for chapters fetch
- [ ] Add `CHAPTERS_LOAD` to loading keys

### Phase 4: Loading Boundaries (Step D) - DEFERRED

> **NOT IN THIS PR** - Defer to future task after core system stabilizes.

~~- [ ] Create `src/infra/loading/components/LoadingBoundary.tsx` (with timer cleanup)~~
~~- [ ] Create `src/infra/loading/components/skeletons/ChatSkeleton.tsx`~~
~~- [ ] Create `src/infra/loading/components/skeletons/StudySkeleton.tsx`~~
~~- [ ] Export skeletons from index~~

### Phase 5: Quality Assurance

- [ ] Run `pnpm ci:local` - all quality gates pass
- [ ] Run `pnpm test:e2e` - E2E tests pass
- [ ] Manual testing: Login flow
- [ ] Manual testing: Signup flow
- [ ] Manual testing: Route transitions (using SystemLink)
- [ ] Manual testing: Study page loading
- [ ] Verify no admin panel behavior changes

---

## Acceptance Criteria Verification

| #   | Criterion                         | Specific Check                                                                             | Pass/Fail |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| 1   | Route loading triggers on click   | Click SystemLink → `loadingManager.isKeyBusy('route:transition')` is `true`                | ☐         |
| 2   | Route loading clears on arrival   | Navigation completes → `isKeyBusy('route:transition')` is `false`                          | ☐         |
| 3   | Route bar appears after threshold | Slow nav (>300ms) → top bar visible with `role="progressbar"`                              | ☐         |
| 4   | Route bar doesn't flash           | Fast nav (<300ms) → bar never becomes visible                                              | ☐         |
| 5   | Route bar is indeterminate        | No percentage; CSS sliding animation                                                       | ☐         |
| 6   | Login button disables on submit   | Click Submit → button has `disabled` attribute                                             | ☐         |
| 7   | Login shows spinner in button     | During submit → Spinner visible inside button                                              | ☐         |
| 8   | Login prevents double-submit      | Rapid clicks → `asyncAction` returns `success: false, error: 'Action already in progress'` | ☐         |
| 9   | Signup button disables on submit  | Click Submit → button has `disabled` attribute                                             | ☐         |
| 10  | Signup shows spinner in button    | During submit → Spinner visible inside button                                              | ☐         |
| 11  | Signup prevents double-submit     | Rapid clicks → `asyncAction` returns `success: false, error: 'Action already in progress'` | ☐         |
| 12  | StudyContent shows loading key    | During fetch → `isKeyBusy('data:chapters')` is `true`                                      | ☐         |
| 13  | Admin panel unchanged             | Visit /admin → no visual changes, no console errors                                        | ☐         |
| 14  | Unit tests pass                   | `pnpm test:int` → all LoadingManager/resolveHref tests pass                                | ☐         |
| 15  | E2E tests pass                    | `pnpm test:e2e` → auth-forms and route-indicator specs pass                                | ☐         |
| 16  | TypeScript compiles               | `pnpm typecheck` → no errors                                                               | ☐         |
| 17  | Lint passes                       | `pnpm lint` → no errors                                                                    | ☐         |

---

## Notes

### Hard Boundaries (CRITICAL)

- **Do not touch Payload Admin** - No admin UI, no admin hooks, no seeds, no internal ops tooling
- **RouteLoadingIndicator must stay minimal** - Thin top bar only, never blocks UI, no modal/overlay
- **No ESLint rule or codemod** - Manual migration of known hotspots only
- **No DAL refactor** - Keep `userApiClient` as thin wrapper for the 4 client fetches only

### Design Decisions

1. **No LoadingProvider Context**: Direct store access via `useSyncExternalStore`. Simpler, avoids re-render cascades, eliminates context wiring.

2. **Version-based Snapshots**: `LoadingManager` uses a `version` number that increments on each change, ensuring `useSyncExternalStore` detects updates correctly.

3. **Generic `isKeyBusy`**: Type-agnostic key check that works for any loading type.

4. **Trigger-based Route Loading**: `SystemLink` and `useRouterWithLoading` register loading at click time, not after pathname changes.

5. **Indeterminate Progress**: Route indicator uses CSS sliding animation, no fake percentages.

6. **Safety Timeout**: Route transitions auto-unregister after 15 seconds if navigation hangs.

7. **Timer Cleanup**: Proper `isMountedRef` and `clearTimers` patterns prevent memory leaks.

8. **Safe JSON Parsing**: `userApiClient` checks `content-type` header before parsing.

9. **URL Normalization**: `resolveHrefToString` utility ensures consistent URL comparison.

10. **Dependency Injection for Testing**: `createAsyncAction` factory allows isolated unit tests.

11. **Flicker Prevention**: `RouteLoadingIndicator` has minimum visible time (500ms).

12. **Conservative Thresholds**: Show after ~300ms, min visible ~500ms, hide delay ~150ms.

### Key Fixes Applied (Round 1)

| Issue                                  | Fix                                                   |
| -------------------------------------- | ----------------------------------------------------- |
| Snapshot immutability (no re-renders)  | Added `version` counter, return new snapshot object   |
| Fake progress in RouteLoadingIndicator | Replaced with indeterminate CSS animation             |
| Wrong navigation lifecycle             | Trigger-based via `SystemLink`/`useRouterWithLoading` |
| `isActionBusy` only for action type    | Added generic `isKeyBusy(key)`                        |
| Unsafe JSON parsing                    | Check `content-type`, handle non-JSON gracefully      |
| E2E tests targeting wrong paths        | Use UI state assertions, not network interception     |

### Key Fixes Applied (Round 2)

| Issue                                  | Fix                                                           |
| -------------------------------------- | ------------------------------------------------------------- |
| Route loading can get stuck            | Added 15s safety timeout auto-unregister                      |
| SystemLink URL comparison unreliable   | Added `resolveHrefToString` utility with normalization        |
| RouteLoadingIndicator stuck-protection | Safety timeout + `isMountedRef` + timer cleanup               |
| LoadingProvider context complexity     | **Removed entirely** - direct store access instead            |
| Playwright RSC interception fragile    | Deterministic test approach without `_rsc` interception       |
| vi.doMock timing issues                | Dependency injection pattern with `createAsyncAction` factory |
| SystemLink enforcement scope creep     | Manual migration of known hotspots only (no ESLint/codemod)   |

### Key Fixes Applied (Round 3 - Scope Reduction)

| Issue                                  | Fix                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------- |
| SystemLink ESLint rule scope creep     | Removed - manual migration of 4 hotspots only                           |
| AsyncAction.ts compile errors          | Fixed type exports: `LoadingManagerInstance`                            |
| Unit test missing `vi` import          | Added to LoadingManager tests                                           |
| LoadingProvider unnecessary complexity | Removed entirely - direct store access                                  |
| Loading keys unused in this task       | Trimmed to only: `ROUTE_TRANSITION`, `LOGIN`, `SIGNUP`, `CHAPTERS_LOAD` |
| Header auth check duplicate work       | Keep auth check inline/silent, no global UI for it                      |

### Key Fixes Applied (Round 4 - Final Polish)

| Issue                            | Fix                                                           |
| -------------------------------- | ------------------------------------------------------------- |
| `NodeJS.Timeout` not portable    | Changed to `ReturnType<typeof setTimeout>`                    |
| `buildCurrentPath` type mismatch | Accept `{ toString(): string }` for `ReadonlyURLSearchParams` |
| E2E tests use fake selectors     | Use real selectors like `a[href="/login"]`                    |
| No test for double-notify        | Added subscription test for manual unregister                 |
| Hash changes trigger loading     | `resolveHrefToString(href, true)` ignores hash                |
| LoadingBoundary not integrated   | Deferred to future task (not in this PR)                      |
| userApiClient returns raw HTML   | Return stable error message, not raw HTML                     |
| EXERCISE_IMPORT unclear scope    | Clarified: not wired in this PR                               |

### Key Fixes Applied (Round 5 - Codebase Alignment)

| Issue                                  | Fix                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Import paths outdated (`@/lib/`, etc.) | Updated to new structure: `@/infra/`, `@/ui/web/`, `@/client/`                  |
| HeaderClient location wrong            | Updated to `src/ui/web/header/Component.client.tsx`                             |
| No shared Spinner/Skeleton components  | Added Spinner component creation to the plan (A.10)                             |
| Forms already have Suspense boundaries | Plan now preserves existing `LoginFormSkeleton` / `SignupFormSkeleton`          |
| SystemEventBus usage in SignupForm     | Plan updated to use `systemEventBus.emit(SYSTEM_EVENTS.*)` instead of analytics |
| useCurrentUser hook in HeaderClient    | Noted that auth loading comes from `useCurrentUser` hook, not direct fetch      |
| returnTo query param support           | Forms already support `returnTo` param; plan preserves this                     |
| Google OAuth button in auth forms      | Plan preserves existing GoogleLoginButton integration                           |

---

## 12. Deliverable Definition

**One PR that:**

- Adds minimal route top-bar indicator (thin, never blocks UI)
- Adds async action wrapper for login/signup
- Adds fetch wrapper for the 3-4 client fetches (no sweeping refactors)
- Updates only user UI navigation hotspots to `SystemLink` (Header, auth form links)
- Adds unit tests that compile and pass
- **Zero admin impact** (verify manually)

**NOT in this PR:**

- No ESLint rule for SystemLink
- No codemod script
- No DAL refactor for Payload queries
- No chat integration
- No broader SystemLink migration
- No LoadingBoundary or skeletons (deferred to future task)

### Future Considerations

- **Stage 2 DAL**: After this implementation stabilizes, consider creating a user data access layer for consistent patterns
- **Chat Integration**: The `useNotebookChat` hook already has loading state; future work could integrate it with the global system
- **Performance Monitoring**: Add instrumentation to track actual loading times for optimization
- **Back/Forward Navigation**: Consider handling `popstate` events if browser back/forward should show loading
- **Broader SystemLink adoption**: Consider with proper review in separate task

# Short Fix List (Must Fix)

1. **Use `SystemLink` (not `next/link`) in hotspots**

- Replace `Link` imports/usages with `SystemLink` in:
  - `src/app/(frontend)/login/LoginForm.tsx` - Signup link in CardFooter
  - `src/app/(frontend)/signup/SignupForm.tsx` - Login link in CardFooter
  - `src/ui/web/header/Nav/index.tsx` - Login and Signup button links (lines 86-91)

2. **Make route-indicator E2E deterministic**

- Add a dev-only slow route (e.g. `/test-slow-nav` with `await setTimeout(1000)`), then assert:
  - progressbar becomes visible after threshold
  - progressbar disappears after navigation completes
    OR remove the route-indicator E2E test (current version doesn't verify the indicator reliably).

3. **Create Spinner component**

- The codebase doesn't have a shared Spinner component yet
- Create `src/infra/loading/components/Spinner.tsx` with size variants (sm, md, lg)
- Used in LoginForm and SignupForm submit buttons during loading state
