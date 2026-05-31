# Fix #2209: Use frontend auth hook in BuyButton

**What changed:** `src/app/(frontend)/products/[slug]/BuyButton.tsx`

**Root cause:** The BuyButton imported `useAuth` from `@payloadcms/ui`, which is the admin-panel auth context. On frontend routes (anything under `/products/[slug]`), this hook always returns `user: null` because it's wired to the Payload admin auth store. This caused the "login to purchase" button to always render, even for authenticated users — blocking the entire checkout flow.

**Fix applied:**
1. Replaced `import { useAuth } from '@payloadcms/ui'` with `import { useCurrentUser } from '@/client/hooks/useCurrentUser'`
2. Replaced `const { user } = useAuth()` with `const { user, isLoading: isAuthLoading } = useCurrentUser()`
3. Added a loading state guard — when `isAuthLoading` is true, renders a disabled placeholder button with a spinner (not the login button), preventing flash of the wrong state during SSR hydration

**Pattern followed:** Mirrored the same `isAuthLoading` guard pattern used in `src/ui/web/header/Component.client.tsx` (the only other frontend component using `useCurrentUser`).
