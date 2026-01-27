# Implementation Plan: Show Authenticated User Icon on Exercise Header

## Overview

Display authenticated user's avatar/dropdown in the ExerciseHeader component on desktop view, replacing Login/Signup buttons when user is logged in.

---

## Files to Modify

### ExerciseHeader Component (1 file)

| File                                                                                                                                                                            | Purpose                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`ExerciseHeader/index.tsx`](<src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseHeader/index.tsx>) | Add user props and UserDropdown component |

---

## Implementation Details

### 1. Update ExerciseHeader Interface

Add `user`, `isAuthLoading`, and `currentUrl` props:

```typescript
interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
  onMenuClick?: () => void
  user?: User | null // NEW: authenticated user
  isAuthLoading?: boolean // NEW: auth loading state
  currentUrl?: string // NEW: current URL for returnTo
}
```

### 2. Import Required Components

```typescript
import { Button } from '@/ui/web/components/button'
import { UserDropdown } from '@/ui/web/UserDropdown'
import type { User } from '@/payload-types'
```

### 3. Add Auth Section in Header

Replace/augment the right-side section with auth UI:

```tsx
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
          {tCommon('login')}
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link href={`/signup${returnToParam}`}>
          {tCommon('signup')}
        </Link>
      </Button>
    </>
  )}
}
```

### 4. Build returnTo Param

The `returnTo` parameter ensures users return to the same lesson page after login/signup:

```typescript
const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''
```

**Desktop Usage:**

- Login link: `/login?returnTo=/courses/.../lessons/...`
- Signup link: `/signup?returnTo=/courses/.../lessons/...`

**Mobile Usage:**

- Mobile login/signup buttons are in `MobileMenu` component
- ReturnTo for mobile is handled via `currentUrl` prop passed to `MobileMenu`
- See `.tasks/login-entry-point/plan.md` for full mobile implementation:
  - `Component.client.tsx` passes `pathname` to `MobileMenu`
  - `MobileMenu` accepts `currentUrl` and passes to `MobileMenuAuthSection`
  - `MobileMenuAuthSection` builds returnTo for login/signup links

### 5. User Dropdown

The `UserDropdown` component (existing at `src/ui/web/UserDropdown`) displays:

- User avatar (from `user.image` or initials)
- Dropdown menu with logout option

---

## Data Flow

```
ExerciseWorkspace (fetches user via /api/users/me)
    ↓ passes user, isAuthLoading, currentUrl
ExerciseHeader
    ↓ renders UserDropdown when user exists
UserDropdown (existing component)
    ↓ shows avatar + dropdown menu
```

---

## RTL Support

The auth section uses `flex-row` (LTR) or `flex-row-reverse` (RTL) via the parent container's class. UserDropdown is RTL-aware internally.

---

## Test Cases

| Test | Description                                   |
| ---- | --------------------------------------------- |
| T1   | Unauthenticated: shows Login/Signup buttons   |
| T2   | Authenticated: shows UserDropdown with avatar |
| T3   | Loading: shows skeleton pulse                 |
| T4   | RTL: auth section positioned correctly        |

---

## Implementation Order

This plan covers **desktop** auth UI in ExerciseHeader.

**Desktop (this plan):**

1. ✅ Update ExerciseHeader interface with user props
2. ✅ Import UserDropdown component
3. ✅ Build returnTo param from currentUrl
4. ✅ Add auth section with conditional rendering (Login/Signup vs UserDropdown)
5. ✅ Commit and push to branch

**Mobile (see `.tasks/login-entry-point/plan.md`):**

- Mobile returnTo is handled in `Component.client.tsx` → `MobileMenu` → `MobileMenuAuthSection`
