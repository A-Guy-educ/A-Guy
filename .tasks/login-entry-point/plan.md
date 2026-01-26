# Implementation Plan: Register/Login Button on Lesson Pages

## Overview

Add Login/Signup buttons to Lesson Pages so unauthenticated users can register/login without breaking the learning flow. After auth, users return to the same lesson URL.

---

## Architecture Clarification

**Lesson vs Exercise pages**: Both use the same `ExerciseWorkspace` + `ExerciseHeader` components:
- `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` → renders `ExerciseWorkspace`
- `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/page.tsx` → renders `ExerciseWorkspace`

**No separate lesson header exists.** Modifying `ExerciseHeader` covers both lesson and exercise pages.

**Auth state**: No shared auth context/provider exists. The main header (`Component.client.tsx`) does per-component fetch via `/api/users/me`. We'll use the same pattern in `ExerciseWorkspace`.

**Mobile returnTo**: Currently hardcoded to `/login` and `/signup` without returnTo. **Must be fixed** to satisfy "return to same lesson" requirement.

---

## Files to Modify

### Phase 1: Sanitization Infrastructure (1 file - verify/extend)

| File | Purpose |
|------|---------|
| [oauth_sanitize.ts](src/infra/auth/oauth_sanitize.ts) | Verify `sanitizeReturnTo` exists and is exported for reuse |

### Phase 2: Login/Signup returnTo Support (6 files)

| File | Purpose |
|------|---------|
| [login/page.tsx](src/app/(frontend)/login/page.tsx) | Read `returnTo` from searchParams, sanitize, redirect if authenticated |
| [login/LoginPageContent.tsx](src/app/(frontend)/login/LoginPageContent.tsx) | Pass sanitized `returnTo` to form |
| [login/LoginForm.tsx](src/app/(frontend)/login/LoginForm.tsx) | Use sanitized `returnTo` for redirect + GoogleLoginButton + cross-link |
| [signup/page.tsx](src/app/(frontend)/signup/page.tsx) | Read `returnTo` from searchParams, sanitize, redirect if authenticated |
| [signup/SignupPageContent.tsx](src/app/(frontend)/signup/SignupPageContent.tsx) | Pass sanitized `returnTo` to form |
| [signup/SignupForm.tsx](src/app/(frontend)/signup/SignupForm.tsx) | Use sanitized `returnTo` for redirect + GoogleLoginButton + cross-link |

### Phase 3: Desktop Auth UI (2 files)

| File | Purpose |
|------|---------|
| [ExerciseWorkspace/index.tsx](src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseWorkspace/index.tsx) | Fetch user state, pass to header |
| [ExerciseHeader/index.tsx](src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseHeader/index.tsx) | Add auth buttons for desktop |

### Phase 4: Mobile returnTo Support (3 files)

| File | Purpose |
|------|---------|
| [Component.client.tsx](src/ui/web/header/Component.client.tsx) | Pass `pathname` to MobileMenu |
| [MobileMenu/index.tsx](src/ui/web/header/MobileMenu/index.tsx) | Accept and pass `currentUrl` prop |
| [MobileMenuAuthSection.tsx](src/ui/web/header/MobileMenu/MobileMenuAuthSection.tsx) | Add `returnTo` to login/signup links |

### Phase 5: Tests (2 new files)

| File | Purpose |
|------|---------|
| `tests/int/exercise-header-auth.int.spec.ts` | NEW - Integration tests |
| `tests/e2e/lesson-auth-flow.e2e.spec.ts` | NEW - E2E test for return-to-lesson |

---

## Implementation Details

### Phase 1: Sanitization Infrastructure

**File**: `src/infra/auth/oauth_sanitize.ts`

Already exists with correct implementation:
```typescript
export function sanitizeReturnTo(returnTo: string | undefined | null): string {
  const defaultRedirect = '/'
  if (!returnTo) return defaultRedirect
  const trimmed = returnTo.trim()
  if (
    trimmed.startsWith('//') ||
    trimmed.match(/^https?:\/\//i) ||
    trimmed.match(/^(data|javascript|mailto):/i)
  ) {
    return defaultRedirect
  }
  if (!trimmed.startsWith('/')) return defaultRedirect
  return trimmed
}
```

**Action**: Verify this function is exported and usable. No changes needed unless export is missing.

---

### Phase 2: Login/Signup returnTo Support

#### 2.1 Login Page

**File**: `src/app/(frontend)/login/page.tsx`

```typescript
import { redirect } from 'next/navigation'
import { getMeUser } from '@/infra/utils/getMeUser'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { LoginPageContent } from './LoginPageContent'

export const metadata = { title: 'Log In' }

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { user } = await getMeUser()
  const { returnTo: rawReturnTo } = await searchParams
  const returnTo = sanitizeReturnTo(rawReturnTo)

  if (user) {
    redirect(returnTo)
  }

  return <LoginPageContent returnTo={returnTo} />
}
```

**File**: `src/app/(frontend)/login/LoginPageContent.tsx`

```typescript
interface LoginPageContentProps {
  returnTo: string  // Always sanitized, defaults to '/'
}

export function LoginPageContent({ returnTo }: LoginPageContentProps) {
  const t = useTranslations('auth.login')

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <LoginForm returnTo={returnTo} />
      </div>
    </div>
  )
}
```

**File**: `src/app/(frontend)/login/LoginForm.tsx`

```typescript
interface LoginFormProps {
  returnTo: string  // Always sanitized
}

export function LoginForm({ returnTo }: LoginFormProps) {
  // ... existing state

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    // ... existing validation
    if (result.success) {
      window.dispatchEvent(new Event('auth:changed'))
      router.push(returnTo)  // Use sanitized returnTo
      router.refresh()
      return
    }
    // ... error handling
  }

  return (
    <Card>
      {/* ... */}
      <CardContent>
        <div className="space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          {/* ... */}
        </div>
        {/* ... form ... */}
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link
            href={returnTo !== '/' ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}
            className="text-primary hover:underline"
          >
            {t('signupLink')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
```

#### 2.2 Signup Page

Same pattern as login:

**File**: `src/app/(frontend)/signup/page.tsx`
- Import `sanitizeReturnTo`
- Add `searchParams` prop with `Promise<{ returnTo?: string }>`
- Sanitize and pass to `SignupPageContent`
- Redirect to sanitized `returnTo` if already authenticated

**File**: `src/app/(frontend)/signup/SignupPageContent.tsx`
- Accept `returnTo: string` prop
- Pass to `SignupForm`

**File**: `src/app/(frontend)/signup/SignupForm.tsx`
- Accept `returnTo: string` prop
- Use in `router.push(returnTo)` after success (line 96)
- Use in `<GoogleLoginButton returnTo={returnTo} />` (line 115)
- Preserve in login link: `href={returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}`

---

### Phase 3: Desktop Auth UI

#### 3.1 ExerciseWorkspace - Add User State Fetching

**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseWorkspace/index.tsx`

```typescript
'use client'

import { ResizablePane } from '@/ui/web/components/resizable-pane'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { usePathname } from 'next/navigation'
import React, { useState, useEffect, useCallback } from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import type { User } from '@/payload-types'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  pdfContent: React.ReactNode
  chatContent: React.ReactNode
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  pdfContent,
  chatContent,
}: ExerciseWorkspaceProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const pathname = usePathname()

  // Auth state (same pattern as Component.client.tsx)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    setIsAuthLoading(true)
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
    } catch {
      setUser(null)
    } finally {
      setIsAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    const handleAuthChange = () => fetchUser()
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader
        exerciseTitle={exerciseTitle}
        backUrl={backUrl}
        onMenuClick={handleMenuClick}
        user={user}
        isAuthLoading={isAuthLoading}
        currentUrl={pathname}
      />
      {/* ... rest unchanged ... */}
    </div>
  )
}
```

#### 3.2 ExerciseHeader - Add Desktop Auth Buttons

**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ExerciseHeader/index.tsx`

```typescript
'use client'

import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { isRTL } from '@/i18n/config'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { ArrowLeft, ArrowRight, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/ui/web/components/button'
import { UserDropdown } from '@/ui/web/UserDropdown'
import type { User } from '@/payload-types'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
  onMenuClick?: () => void
  user?: User | null
  isAuthLoading?: boolean
  currentUrl?: string
}

export function ExerciseHeader({
  exerciseTitle,
  backUrl,
  onMenuClick,
  user,
  isAuthLoading,
  currentUrl,
}: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const tAuth = useTranslations('common.header')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else if (backUrl) {
      router.push(backUrl)
    } else {
      router.push('/courses')
    }
  }

  // Build returnTo URL (path only, no query params for simplicity)
  const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center flex-shrink-0 z-[100] relative">
      {/* Back button - unchanged */}
      <button
        onClick={handleBack}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0 absolute cursor-pointer',
          rtl ? 'right-5' : 'left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {rtl ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </button>

      {/* Center: Exercise Title - unchanged */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Right side in LTR / Left side in RTL */}
      <div
        className={cn(
          'flex items-center gap-1 flex-shrink-0 fixed top-[10px] z-[101]',
          rtl ? 'flex-row-reverse' : 'flex-row',
        )}
        style={{
          [rtl ? 'left' : 'right']: '20px',
        }}
      >
        {/* Desktop Auth Section */}
        <div className="hidden lg:flex items-center gap-2" data-testid="exercise-header-auth">
          {isAuthLoading ? (
            <div className="w-20 h-8" aria-hidden="true" />
          ) : user ? (
            <UserDropdown user={user} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/login${returnToParam}`}>
                  {tAuth('login')}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/signup${returnToParam}`}>
                  {tAuth('signup')}
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Logo - Hidden on mobile, shown on desktop */}
        <TelescopeLogo className="h-8 w-auto hidden lg:flex" />

        {/* Hamburger menu - Shown on mobile, hidden on desktop */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden text-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
        )}
      </div>
    </header>
  )
}
```

---

### Phase 4: Mobile returnTo Support

#### 4.1 Component.client.tsx - Pass pathname to MobileMenu

**File**: `src/ui/web/header/Component.client.tsx`

Add `pathname` prop to MobileMenu:

```typescript
<MobileMenu
  isOpen={isMobileMenuOpen}
  onClose={() => setIsMobileMenuOpen(false)}
  data={data}
  user={user}
  isAuthLoading={isAuthLoading}
  currentUrl={pathname}  // NEW - pathname already available via usePathname()
/>
```

#### 4.2 MobileMenu - Accept and pass currentUrl

**File**: `src/ui/web/header/MobileMenu/index.tsx`

```typescript
interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  data: HeaderType
  user: User | null
  isAuthLoading: boolean
  currentUrl?: string  // NEW
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  data,
  user,
  isAuthLoading,
  currentUrl,  // NEW
}) => {
  // ... existing code ...

  return (
    <>
      {/* ... backdrop ... */}
      <div className={/* ... */}>
        {/* ... nav content ... */}
        <div className="px-6 py-4 border-t border-border mt-auto">
          <MobileMenuAuthSection
            user={user}
            isAuthLoading={isAuthLoading}
            onClose={onClose}
            currentUrl={currentUrl}  // NEW
          />
        </div>
      </div>
    </>
  )
}
```

#### 4.3 MobileMenuAuthSection - Add returnTo to links

**File**: `src/ui/web/header/MobileMenu/MobileMenuAuthSection.tsx`

```typescript
interface MobileMenuAuthSectionProps {
  user: User | null
  isAuthLoading: boolean
  onClose: () => void
  currentUrl?: string  // NEW
}

export function MobileMenuAuthSection({
  user,
  isAuthLoading,
  onClose,
  currentUrl,  // NEW
}: MobileMenuAuthSectionProps) {
  // ... existing code ...

  // Build returnTo param
  const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''

  // ... if (user) return logged-in UI ...

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" asChild className="justify-start">
        <Link href={`/login${returnToParam}`} onClick={onClose}>
          {tCommon('login')}
        </Link>
      </Button>
      <Button asChild className="justify-start">
        <Link href={`/signup${returnToParam}`} onClick={onClose}>
          {tCommon('signup')}
        </Link>
      </Button>
    </div>
  )
}
```

---

## Test Plan

### Integration Tests

**File**: `tests/int/exercise-header-auth.int.spec.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ExerciseHeader Auth', () => {
  describe('U1 - Unauthenticated state', () => {
    it('renders Login and Signup buttons when user is null')
    it('Login link includes returnTo parameter with current URL')
    it('Signup link includes returnTo parameter with current URL')
  })

  describe('U2 - Authenticated state', () => {
    it('renders UserDropdown when user is logged in')
    it('does not render Login/Signup buttons when authenticated')
  })

  describe('U3 - Loading state', () => {
    it('renders loading skeleton during auth check')
  })

  describe('U4 - RTL alignment', () => {
    it('auth section positioned correctly in RTL mode (flex-row-reverse)')
  })
})
```

### E2E Tests (CRITICAL - BLOCKING)

**File**: `tests/e2e/lesson-auth-flow.e2e.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Lesson Page Auth Flow', () => {
  // Use a real lesson URL from seeded test data
  const LESSON_URL = '/courses/test-course/chapters/ch-1/lessons/lesson-1'

  test('E1 - Login returns to same lesson URL (CRITICAL)', async ({ page }) => {
    // 1. Go to lesson page as unauthenticated user
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // 2. Set desktop viewport and verify auth buttons visible
    await page.setViewportSize({ width: 1280, height: 720 })
    const authSection = page.getByTestId('exercise-header-auth')
    const loginBtn = authSection.getByRole('link', { name: /log in/i })
    await expect(loginBtn).toBeVisible()

    // 3. Verify returnTo parameter in href
    const href = await loginBtn.getAttribute('href')
    expect(href).toContain('returnTo=')
    expect(href).toContain(encodeURIComponent(LESSON_URL))

    // 4. Click login and verify navigation
    await loginBtn.click()
    await expect(page).toHaveURL(/\/login\?returnTo=/)

    // 5. Complete login with test user
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')

    // 6. Verify redirect back to exact lesson URL
    await expect(page).toHaveURL(LESSON_URL, { timeout: 10000 })

    // 7. Smoke check - header visible
    await expect(page.locator('header')).toBeVisible()
  })

  test('Desktop shows auth buttons, mobile shows hamburger', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // Desktop - auth buttons visible
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.getByTestId('exercise-header-auth')).toBeVisible()

    // Mobile - auth buttons hidden, hamburger visible
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.getByTestId('exercise-header-auth')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible()
  })

  test('Shows UserDropdown when logged in', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    // Navigate to lesson
    await page.goto(LESSON_URL)
    await page.setViewportSize({ width: 1280, height: 720 })

    // Verify UserDropdown visible
    await expect(page.getByTestId('user-dropdown')).toBeVisible()
  })
})
```

### CI Requirements
- **E1 test MUST pass in CI (blocking)**
- Integration tests MUST pass (blocking)

---

## Security Considerations

1. **`sanitizeReturnTo` applied everywhere**:
   - Login page: sanitizes before redirect (if authenticated) and before passing to form
   - Signup page: same pattern
   - All forms use pre-sanitized value
   - OAuth flow already uses sanitization in callback handler

2. **Client-side `router.push()`**: Inherently same-origin only, but we still use sanitized values for defense in depth

3. **`returnTo` preserves path only**: `usePathname()` returns path without query string. This is documented and intentional for v1.

---

## Verification Steps

After implementation:

1. **Desktop**: Login/Signup buttons appear in ExerciseHeader on lesson pages
2. **Mobile**: Hamburger menu → Login/Signup links include returnTo
3. **RTL**: Buttons positioned correctly in Hebrew locale
4. **Login flow**: User returns to exact lesson URL after login
5. **Signup flow**: User returns to exact lesson URL after signup
6. **Logged-in state**: UserDropdown appears instead of buttons
7. **Cross-links**: Login ↔ Signup links preserve returnTo
8. **Tests pass**: `pnpm test:int` and `pnpm test:e2e`

---

## Implementation Order

1. ✅ Verify `sanitizeReturnTo` is exported from `oauth_sanitize.ts`
2. Login page + LoginPageContent + LoginForm (returnTo support)
3. Signup page + SignupPageContent + SignupForm (returnTo support)
4. ExerciseWorkspace (user state fetching)
5. ExerciseHeader (desktop auth buttons)
6. Component.client.tsx → MobileMenu → MobileMenuAuthSection (mobile returnTo)
7. Integration tests
8. E2E test E1 (blocking)
