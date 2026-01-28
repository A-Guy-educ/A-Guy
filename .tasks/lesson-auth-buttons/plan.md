# Implementation Plan: Show Authenticated User Icon on Exercise Header

## Overview

Display authenticated user's avatar/dropdown in the ExerciseHeader component on desktop view, replacing Login/Signup buttons when user is logged in.

**Key improvement:** Create a reusable `useCurrentUser()` hook instead of duplicating fetch logic.

---

## Files to Modify

| File | Change |
|------|--------|
| [`src/hooks/useCurrentUser.ts`](src/hooks/useCurrentUser.ts) | **NEW** - Reusable client-side auth hook |
| [`src/ui/web/header/Component.client.tsx`](src/ui/web/header/Component.client.tsx) | Refactor to use `useCurrentUser()` hook |
| [`src/app/.../ExerciseWorkspace/index.tsx`](src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseWorkspace/index.tsx) | Use `useCurrentUser()` hook, pass to header |
| [`src/app/.../ExerciseHeader/index.tsx`](src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseHeader/index.tsx) | Add user props and auth UI |

---

## Implementation Details

### Step 1: Create `useCurrentUser` Hook

**File:** `src/hooks/useCurrentUser.ts`

Extract the auth fetch logic from `HeaderClient` into a reusable hook:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@/payload-types'

interface UseCurrentUserReturn {
  user: User | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Listen for auth changes (login/logout)
  useEffect(() => {
    const handleAuthChange = () => fetchUser()
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

  return { user, isLoading, error, refetch: fetchUser }
}
```

### Step 2: Refactor HeaderClient

**File:** `src/ui/web/header/Component.client.tsx`

Replace inline fetch logic with the new hook:

```typescript
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function HeaderClient({ data }: { data: HeaderType }) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()
  // ... rest unchanged
}
```

**Remove:**
- `useState` for `user` and `isAuthLoading`
- `fetchUser` callback
- Both `useEffect` hooks (mount fetch + auth:changed listener)

### Step 3: Update ExerciseWorkspace

**File:** `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseWorkspace/index.tsx`

```typescript
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePathname } from 'next/navigation'

// Inside component:
const { user, isLoading: isAuthLoading } = useCurrentUser()
const pathname = usePathname()

// Pass to ExerciseHeader:
<ExerciseHeader
  exerciseTitle={exerciseTitle}
  backUrl={backUrl}
  onMenuClick={handleMenuClick}
  user={user}
  isAuthLoading={isAuthLoading}
  currentUrl={pathname}
/>
```

### Step 4: Update ExerciseHeader Interface

**File:** `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseHeader/index.tsx`

```typescript
import type { User } from '@/payload-types'
import { UserDropdown } from '@/ui/web/UserDropdown'
import { Button } from '@/ui/web/components/button'
import Link from 'next/link'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
  onMenuClick?: () => void
  user?: User | null
  isAuthLoading?: boolean
  currentUrl?: string
}
```

### Step 5: Add Auth Section in Header

```tsx
const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''

{/* Desktop Auth Section */}
<div className="hidden lg:flex items-center gap-2" data-testid="exercise-header-auth">
  {isAuthLoading ? (
    <div className="w-20 h-8 animate-pulse bg-muted rounded" aria-hidden="true" />
  ) : user ? (
    <UserDropdown user={user} />
  ) : (
    <>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/login${returnToParam}`}>
          {t('common.login')}
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link href={`/signup${returnToParam}`}>
          {t('common.signup')}
        </Link>
      </Button>
    </>
  )}
</div>
```

---

## Data Flow

```
useCurrentUser() hook (fetches /api/users/me)
    ↓ returns { user, isLoading }
ExerciseWorkspace (uses hook)
    ↓ passes user, isAuthLoading, currentUrl (from usePathname)
ExerciseHeader
    ↓ renders UserDropdown when user exists
UserDropdown (existing component)
    ↓ shows avatar + dropdown menu with logout
```

---

## Benefits of Hook Approach

1. **DRY** - Single source of truth for client-side auth
2. **Consistent** - HeaderClient and ExerciseWorkspace use same logic
3. **Testable** - Hook can be unit tested independently
4. **Maintainable** - Fix bugs or add features in one place
5. **Future-proof** - Easy to add caching, optimistic updates, etc.

---

## RTL Support

The auth section uses `flex-row` (LTR) or `flex-row-reverse` (RTL) via the parent container's class. UserDropdown is RTL-aware internally.

---

## Test Cases

| Test | Description |
|------|-------------|
| T1 | Unauthenticated: shows Login/Signup buttons |
| T2 | Authenticated: shows UserDropdown with avatar |
| T3 | Loading: shows skeleton pulse |
| T4 | RTL: auth section positioned correctly |
| T5 | Hook: refetch on `auth:changed` event |

---

## Scope

**In scope:**
- Create `useCurrentUser` hook
- Refactor HeaderClient to use hook
- Add auth UI to ExerciseHeader (desktop)

**Out of scope:**
- Mobile auth buttons (separate task)
- returnTo handling in login/signup pages (separate task)
- Full AuthProvider context (hook is sufficient)

---

## Implementation Order

1. [ ] Create `src/hooks/useCurrentUser.ts`
2. [ ] Run typecheck to verify hook
3. [ ] Refactor `HeaderClient` to use hook
4. [ ] Verify header still works correctly
5. [ ] Update `ExerciseWorkspace` to use hook
6. [ ] Update `ExerciseHeader` with auth UI
7. [ ] Test all scenarios
8. [ ] Commit and push
