# Fix: Login button stuck on "Logging in..."

## What

Fixed the login button permanently showing "Logging in..." after a successful authentication in `src/app/(frontend)/login/LoginForm.tsx`.

## Root Cause

In `handleSubmit`, `setIsLoading(false)` was placed in a `finally` block that executed AFTER `window.location.href = returnTo`. When the browser navigated away, React's state update for `isLoading = false` never rendered before the component unmounted, leaving the button stuck in its disabled state with "Logging in..." text.

## Fix

Moved `setIsLoading(false)` to execute immediately after `loginAction` resolves but BEFORE the redirect:

```tsx
// Before (buggy)
try {
  const result = await loginAction(formData)
  if (result.success) {
    window.location.href = returnTo
  }
} catch {
  setError(...)
} finally {
  setIsLoading(false)  // Runs AFTER redirect = too late
}

// After (fixed)
try {
  const result = await loginAction(formData)
  setIsLoading(false)  // Runs before redirect = correct
  if (result.success) {
    window.location.assign(returnTo)
  }
} catch {
  setIsLoading(false)
  setError(...)
}
```

Also changed `window.location.href = returnTo` to `window.location.assign(returnTo)` for more reliable navigation behavior.

## Verification

- Unit tests: 255 files passed
- Lint: passes (pre-existing warning in unrelated file)
- Format: passes
- TypeScript: passes