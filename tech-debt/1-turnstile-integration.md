# Tech Debt: Cloudflare Turnstile Integration

**Priority**: Medium
**Status**: ⚠️ PARTIALLY COMPLETED - Using Test Keys
**Created**: 2025-12-30
**Completed**: 2025-12-30 (localhost only)
**Related to**: Public signup and login anti-spam protection

## ⚠️ IMPORTANT: Currently Using Test Keys

The implementation is complete but uses **Cloudflare test keys** that work for localhost only:

- Site Key: `1x00000000000000000000AA` (always passes)
- Secret Key: `1x0000000000000000000000000000000AA` (always passes)

**Before deploying to production:**

1. Get real keys from [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Add your domain to Turnstile
3. Replace test keys in `.env` with production keys

## Context

The public signup page (`/signup`) and login page (`/login`) now implement three layers of bot protection:

1. ✅ Honeypot field (invisible field that bots fill) - signup only
2. ✅ Rate limiting (5 attempts per 15 minutes per email) - signup only
3. ✅ **COMPLETED**: CAPTCHA verification (Cloudflare Turnstile) - both signup and login

## What Needs to Be Done

### 1. Get Cloudflare Turnstile Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to "Turnstile" section
3. Create a new site
4. Get **Site Key** and **Secret Key**

### 2. Add Environment Variables

Add to `.env`:

```env
# Cloudflare Turnstile (bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key-here
TURNSTILE_SECRET_KEY=your-secret-key-here
```

Add to `.env.example`:

```env
# Cloudflare Turnstile (bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

### 3. Install Turnstile Package

```bash
pnpm add @marsidev/react-turnstile
```

### 4. Update Signup Form

**File**: `src/app/(frontend)/signup/SignupForm.tsx`

Add Turnstile widget:

```tsx
import { Turnstile } from '@marsidev/react-turnstile'

// In the form, add:
;<Turnstile
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
  onSuccess={(token) => setTurnstileToken(token)}
/>

// Add turnstileToken to form submission
```

### 5. Update Server Action

**File**: `src/app/(frontend)/signup/actions.ts`

Add verification (around line 67, before creating user):

```typescript
// Verify Turnstile token
const turnstileToken = formData.get('cf-turnstile-response')

if (!turnstileToken) {
  return {
    success: false,
    message: 'Please complete the CAPTCHA verification.',
  }
}

const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: turnstileToken,
  }),
})

const turnstileResult = await turnstileResponse.json()

if (!turnstileResult.success) {
  return {
    success: false,
    message: 'CAPTCHA verification failed. Please try again.',
  }
}
```

## Verification Checklist

✅ Implementation Complete:

- [x] Turnstile widget appears on signup form
- [x] Turnstile widget appears on login form
- [x] Form submission fails without completing CAPTCHA
- [x] Server validates token before creating user / logging in
- [x] Invalid/expired tokens are rejected
- [x] Error messages are user-friendly
- [x] Test keys configured for localhost development
- [x] i18n support for all error messages

## Estimated Effort

**30-45 minutes**

## Dependencies

- Cloudflare account (free)
- `@marsidev/react-turnstile` package

## Notes

- Turnstile is privacy-friendly (no Google dependency)
- Free tier: 1 million challenges per month
- Invisible mode available for better UX
- Falls back to interactive challenge if suspicious

## References

- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [React Turnstile Package](https://github.com/marsidev/react-turnstile)
- Current implementation: `src/app/(frontend)/signup/actions.ts:67` (TODO comment)
